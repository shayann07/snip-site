cmake_minimum_required(VERSION 3.22.1)
project(mp3lame C)

set(CMAKE_C_STANDARD 99)
set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} -Wl,-z,max-page-size=16384")

add_definitions(-DHAVE_CONFIG_H)

include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/libmp3lame
    ${CMAKE_CURRENT_SOURCE_DIR}
)

set(LAME_SOURCES
    libmp3lame/bitstream.c
    libmp3lame/encoder.c
    libmp3lame/fft.c
    libmp3lame/gain_analysis.c
    libmp3lame/id3tag.c
    libmp3lame/lame.c
    libmp3lame/mpglib_interface.c
    libmp3lame/newmdct.c
    libmp3lame/presets.c
    libmp3lame/psymodel.c
    libmp3lame/quantize.c
    libmp3lame/quantize_pvt.c
    libmp3lame/reservoir.c
    libmp3lame/set_get.c
    libmp3lame/tables.c
    libmp3lame/takehiro.c
    libmp3lame/util.c
    libmp3lame/vbrquantize.c
    libmp3lame/VbrTag.c
    libmp3lame/version.c
)

find_library(math-lib m)

add_library(
    mp3lame
    SHARED
    ${LAME_SOURCES}
)

target_link_libraries(
    mp3lame
    ${math-lib}
)

target_link_options(
    mp3lame
    PRIVATE
    "-Wl,-z,max-page-size=16384"
)
