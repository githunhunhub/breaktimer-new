BreakTimer-new Portable
=======================

Run breaktimer-new.exe directly from this folder. Installation is not required.

Portable data
-------------

Settings and WebView2 data are stored next to the executable:

  data\settings.json
  data\webview2\

The data folder is created on first successful launch. Keep this folder with
the executable when moving the portable copy. Delete it to reset BreakTimer-new.

The portable copy uses the same Windows app identity as the installed version,
so only one BreakTimer-new instance can run at a time.

Launch at login
---------------

If Launch at login is enabled, Windows registers the current path of
breaktimer-new.exe. Turn it off and on again after moving the portable folder.

Requirements
------------

Windows 10 or Windows 11 with the Microsoft Edge WebView2 Runtime. The runtime
is included with current Windows versions and may already be installed.
