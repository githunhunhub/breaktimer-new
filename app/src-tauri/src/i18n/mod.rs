use std::collections::{BTreeMap, HashMap};
use std::sync::LazyLock;

use include_dir::{Dir, include_dir};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

const BASE_LOCALE: &str = "en-US";

static LOCALES: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../locales");
static PLACEHOLDER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\{([^{}]+)\}").expect("valid placeholder regex"));
static BUNDLED: LazyLock<Catalog> = LazyLock::new(|| {
    let sources = LOCALES
        .files()
        .filter_map(|file| file.contents_utf8())
        .collect::<Vec<_>>();
    Catalog::from_sources(&sources)
});

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Language {
    pub locale: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct I18nState {
    pub language: Option<String>,
    pub effective_locale: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Message {
    Text(String),
    Plural { one: String, other: String },
}

#[derive(Debug, Clone)]
struct LocaleResource {
    language: Language,
    aliases: Vec<String>,
    messages: BTreeMap<String, Message>,
}

#[derive(Debug, Clone, Default)]
pub struct Catalog {
    resources: Vec<LocaleResource>,
    messages: HashMap<String, BTreeMap<String, Message>>,
}

impl Catalog {
    pub fn from_sources(sources: &[&str]) -> Self {
        let mut resources = sources
            .iter()
            .filter_map(|source| parse_locale_resource(source))
            .collect::<Vec<_>>();
        resources.sort_by(|left, right| left.language.locale.cmp(&right.language.locale));
        let messages = resources
            .iter()
            .map(|resource| (resource.language.locale.clone(), resource.messages.clone()))
            .collect();

        Self {
            resources,
            messages,
        }
    }

    #[cfg(test)]
    pub fn languages(&self) -> Vec<Language> {
        self.resources
            .iter()
            .map(|resource| resource.language.clone())
            .collect()
    }

    pub fn translate(&self, locale: &str, key: &str, params: &[(&str, &str)]) -> String {
        let resolved = self.resolve_locale(locale);
        let message = self
            .messages
            .get(&resolved)
            .and_then(|messages| messages.get(key))
            .or_else(|| {
                self.messages
                    .get(BASE_LOCALE)
                    .and_then(|messages| messages.get(key))
            });

        let Some(message) = message else {
            return key.to_string();
        };
        let template = match message {
            Message::Text(value) => value,
            Message::Plural { one, other } => {
                if params
                    .iter()
                    .find(|(name, _)| *name == "count")
                    .and_then(|(_, value)| value.parse::<f64>().ok())
                    == Some(1.0)
                {
                    one
                } else {
                    other
                }
            }
        };

        PLACEHOLDER
            .replace_all(template, |captures: &regex::Captures<'_>| {
                let name = &captures[1];
                params
                    .iter()
                    .find(|(param, _)| *param == name)
                    .map(|(_, value)| (*value).to_string())
                    .unwrap_or_else(|| captures[0].to_string())
            })
            .into_owned()
    }

    #[cfg(test)]
    pub fn message_keys(&self, locale: &str) -> Vec<String> {
        self.messages
            .get(&self.resolve_locale(locale))
            .map(|messages| messages.keys().cloned().collect())
            .unwrap_or_default()
    }

    fn resolve_locale(&self, locale: &str) -> String {
        let wanted = normalize_locale(locale);
        self.resources
            .iter()
            .find(|resource| {
                normalize_locale(&resource.language.locale) == wanted
                    || resource
                        .aliases
                        .iter()
                        .any(|alias| normalize_locale(alias) == wanted)
            })
            .map(|resource| resource.language.locale.clone())
            .unwrap_or_else(|| BASE_LOCALE.to_string())
    }
}

pub fn system_locale() -> String {
    sys_locale::get_locale().unwrap_or_else(|| BASE_LOCALE.to_string())
}

pub fn resolve_locale(preference: Option<&str>, system_locale: &str) -> String {
    BUNDLED.resolve_locale(preference.unwrap_or(system_locale))
}

pub fn translate(locale: &str, key: &str, params: &[(&str, &str)]) -> String {
    BUNDLED.translate(locale, key, params)
}

fn parse_locale_resource(raw: &str) -> Option<LocaleResource> {
    let value: Value = serde_json::from_str(raw).ok()?;
    let locale = value.get("locale")?.as_str()?.trim();
    let name = value.get("name")?.as_str()?.trim();
    let aliases = value.get("aliases")?.as_array()?;
    let messages = value.get("messages")?.as_object()?;

    if locale.is_empty() || name.is_empty() || !valid_messages(messages) {
        return None;
    }

    let aliases = aliases
        .iter()
        .map(Value::as_str)
        .collect::<Option<Vec<_>>>()?;

    Some(LocaleResource {
        language: Language {
            locale: locale.to_string(),
            name: name.to_string(),
        },
        aliases: aliases.into_iter().map(str::to_string).collect(),
        messages: flatten_messages(messages, ""),
    })
}

fn valid_messages(messages: &serde_json::Map<String, Value>) -> bool {
    messages.values().all(|value| match value {
        Value::String(_) => true,
        Value::Object(object) => {
            let has_plural_key = object.contains_key("one") || object.contains_key("other");
            if has_plural_key {
                object.len() == 2
                    && object.get("one").is_some_and(Value::is_string)
                    && object.get("other").is_some_and(Value::is_string)
            } else {
                valid_messages(object)
            }
        }
        _ => false,
    })
}

fn flatten_messages(
    messages: &serde_json::Map<String, Value>,
    prefix: &str,
) -> BTreeMap<String, Message> {
    let mut flattened = BTreeMap::new();

    for (key, value) in messages {
        let path = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{prefix}.{key}")
        };

        match value {
            Value::String(text) => {
                flattened.insert(path, Message::Text(text.clone()));
            }
            Value::Object(object) if object.contains_key("one") && object.contains_key("other") => {
                flattened.insert(
                    path,
                    Message::Plural {
                        one: object["one"].as_str().unwrap_or_default().to_string(),
                        other: object["other"].as_str().unwrap_or_default().to_string(),
                    },
                );
            }
            Value::Object(object) => {
                flattened.extend(flatten_messages(object, &path));
            }
            _ => {}
        }
    }

    flattened
}

fn normalize_locale(locale: &str) -> String {
    locale.replace('_', "-").to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_exact_locale_aliases_and_fallbacks() {
        assert_eq!(resolve_locale(Some("zh-Hans"), "en-US"), "zh-CN");
        assert_eq!(resolve_locale(Some("zh_CN"), "en-US"), "zh-CN");
        assert_eq!(resolve_locale(Some("fr-FR"), "zh-CN"), "en-US");
        assert_eq!(resolve_locale(None, "zh-CN"), "zh-CN");
        assert_eq!(resolve_locale(None, "fr-FR"), "en-US");
    }

    #[test]
    fn translates_interpolates_plurals_and_falls_back() {
        let catalog = Catalog::from_sources(&[
            r#"{"locale":"en-US","name":"English","aliases":["en"],"messages":{"demo":{"hello":"Hello, {name}!","items":{"one":"{count} item","other":"{count} items"}},"settings":{"title":"Settings"}}}"#,
            r#"{"locale":"zh-CN","name":"简体中文","aliases":["zh"],"messages":{}}"#,
        ]);

        assert_eq!(translate("zh-CN", "settings.title", &[]), "设置");
        assert_eq!(
            catalog.translate("zh-CN", "settings.title", &[]),
            "Settings"
        );
        assert_eq!(
            catalog.translate("en-US", "demo.hello", &[("name", "Ada")]),
            "Hello, Ada!"
        );
        assert_eq!(
            catalog.translate("en-US", "demo.items", &[("count", "1")]),
            "1 item"
        );
        assert_eq!(
            catalog.translate("en-US", "demo.items", &[("count", "-1")]),
            "-1 items"
        );
        assert_eq!(
            catalog.translate("en-US", "missing.key", &[]),
            "missing.key"
        );
    }

    #[test]
    fn skips_malformed_resources() {
        let catalog = Catalog::from_sources(&[
            r#"{"locale":"bad","name":"Bad","aliases":[],"messages":{"x":{"one":"x"}}}"#,
        ]);
        assert!(catalog.languages().is_empty());
    }

    #[test]
    fn adds_a_third_language_without_registration_code() {
        let catalog = Catalog::from_sources(&[
            r#"{"locale":"fr-FR","name":"Français","aliases":["fr"],"messages":{"settings":{"title":"Paramètres"}}}"#,
        ]);

        assert_eq!(
            catalog.languages(),
            vec![Language {
                locale: "fr-FR".to_string(),
                name: "Français".to_string(),
            }]
        );
        assert_eq!(
            catalog.translate("fr-FR", "settings.title", &[]),
            "Paramètres"
        );
    }

    #[test]
    fn keeps_the_first_party_locale_key_sets_complete() {
        assert_eq!(
            BUNDLED.message_keys("zh-CN"),
            BUNDLED.message_keys(BASE_LOCALE)
        );
        assert_eq!(
            BUNDLED.languages(),
            vec![
                Language {
                    locale: "en-US".to_string(),
                    name: "English".to_string(),
                },
                Language {
                    locale: "zh-CN".to_string(),
                    name: "简体中文".to_string(),
                },
            ]
        );
    }
}
