# LAME 3.100 — corresponding source for `libmp3lame.so` in Snip

Snip ships LAME 3.100 as its own shared library, `libmp3lame.so`, dynamically linked by the app.
LAME is licensed under the GNU Lesser General Public License v2.1 — see `COPYING` in the source tree.

This folder contains the LAME sources exactly as compiled into Snip, plus the build configuration
(`config.h` and `CMakeLists.txt`) used to produce `libmp3lame.so` for `arm64-v8a`, `armeabi-v7a`
and `x86_64` with the Android NDK. To build a replacement library, see `BUILD.md`.

Upstream project: https://lame.sourceforge.io/
