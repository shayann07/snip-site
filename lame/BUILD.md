# Building `libmp3lame.so` from Source

This document describes how to rebuild the standalone `libmp3lame.so` shared library from the corresponding source in this folder for use in Snip.

## Prerequisites

- **Android NDK**: r27c (version `27.2.12479018`) or r28 (version `28.2.13676358`)
- **CMake**: 3.22.1 or newer
- **Host OS**: Linux, macOS, or Windows (with PowerShell / Command Prompt)

Set your environment variable to point to your NDK installation:

```bash
# Linux / macOS
export ANDROID_NDK=$ANDROID_HOME/ndk/27.2.12479018

# Windows PowerShell
$env:ANDROID_NDK = "$env:ANDROID_HOME\ndk\27.2.12479018"
```

## Build Instructions

Snip supports three architectures:
- `arm64-v8a` (64-bit ARM, Android standard)
- `armeabi-v7a` (32-bit ARM, legacy devices like Huawei Y9 2019)
- `x86_64` (64-bit x86, emulators and Chromebooks)

### 1. arm64-v8a

```bash
cmake -B build/arm64-v8a \
  -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \
  -DANDROID_ABI=arm64-v8a \
  -DANDROID_PLATFORM=android-26 \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_SHARED_LINKER_FLAGS="-Wl,-z,max-page-size=16384"

cmake --build build/arm64-v8a --config Release
```

Output: `build/arm64-v8a/libmp3lame.so`

### 2. armeabi-v7a

```bash
cmake -B build/armeabi-v7a \
  -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \
  -DANDROID_ABI=armeabi-v7a \
  -DANDROID_ARM_NEON=TRUE \
  -DANDROID_PLATFORM=android-26 \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_SHARED_LINKER_FLAGS="-Wl,-z,max-page-size=16384"

cmake --build build/armeabi-v7a --config Release
```

Output: `build/armeabi-v7a/libmp3lame.so`

### 3. x86_64

```bash
cmake -B build/x86_64 \
  -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \
  -DANDROID_ABI=x86_64 \
  -DANDROID_PLATFORM=android-26 \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_SHARED_LINKER_FLAGS="-Wl,-z,max-page-size=16384"

cmake --build build/x86_64 --config Release
```

Output: `build/x86_64/libmp3lame.so`

---

## Verifying 16 KB Page Alignment

To comply with Google Play and Android 15+ 16 KB memory page requirements, inspect the built shared library using the NDK's `llvm-readelf`:

```bash
$ANDROID_NDK/toolchains/llvm/prebuilt/*/bin/llvm-readelf -l build/arm64-v8a/libmp3lame.so
```

Confirm that every `LOAD` segment displays an alignment of `0x4000` (16,384 bytes).

## Relinking / Replacing in Snip

In accordance with LGPL v2.1 § 6:
1. Unpack the target Snip APK (`apktool d snip.apk` or `unzip snip.apk`).
2. Replace `lib/<abi>/libmp3lame.so` with your newly compiled `libmp3lame.so`.
3. Repack, zipalign, and sign the APK with a local test key.
4. Install and run on device (`adb install -r snip-modified.apk`).
