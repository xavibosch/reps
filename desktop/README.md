# Reps, native shell

Wraps the deployed dashboard in a real Mac app so the camera opens on launch
without a permission prompt every time.

## Why this exists

In a browser tab the camera grant does not stick, so hand tracking never just
starts. This shell answers the web permission in code, which leaves exactly one
prompt: the macOS system one, shown once on first launch, the same as any
native app would trigger. There is no way to remove that one, and an app that
could take the camera with no prompt at all would be a bug in macOS.

## Build

```
npm install
npm run package      # -> build/Reps-darwin-arm64/Reps.app
npm run install-app  # -> /Applications/Reps.app, ad-hoc signed
```

## Things that will bite you

- **`camera.plist` is not optional.** Without `NSCameraUsageDescription`
  macOS terminates the app the moment it touches the camera, instead of
  prompting.
- **Sign after copying, not before.** The Desktop is iCloud synced and the file
  provider writes `com.apple.FinderInfo` onto the bundle, which makes
  `codesign --verify` fail with "resource fork, Finder information, or similar
  detritus not allowed". `xattr -cr` then sign, in `/Applications`.
- **Keep the bundle identifier stable.** macOS ties the camera grant to it, so
  changing it means being asked again. Expect the prompt after a rebuild
  anyway: ad-hoc re-signing changes the code signature, and TCC treats that as
  a different binary. One click, once per rebuild.
- **Only launch Spotify when it is not already running.** `open -g` keeps a
  *launch* in the background, but it does not stop an app that is already up
  from being brought to the front, so warming up unconditionally handed focus
  to Spotify exactly when there was no reason to touch it.
- **The window loads the deployed URL, not local files.** The Spotify redirect
  URI is registered against that exact origin and PKCE would break against
  `file://` or a custom protocol. `accounts.spotify.com` is allowed to load
  in-window for the same reason; everything else opens in the real browser.
- **`--icon` is ignored by @electron/packager v20** on this macOS, which looks
  for the new `.icon` format. The `package` script copies `icon.icns` over
  `Resources/electron.icns` afterwards instead.
