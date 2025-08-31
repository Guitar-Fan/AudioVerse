Welcome to the REAPER 7.45 for linux/x86_64 tarball

- Requirements:

  + libc6, libstdc++ for gcc 4.x or later
  + libgdk-3 (you can also target headless or libgdk-2 if you build your own
    libSwell from WDL, see below)
  + ALSA

- Optional dependencies:

  + JACK
  + PulseAudio
  + libmp3lame for MP3 encoding
  + ffmpeg 3.0-4.2 for video encoding and improved decoding
  + VLC 3.x for video decoding

- Run without installing:

You can run REAPER directly from the extracted tarball -- simply navigate to
REAPER/ and run "reaper".

By default configuration state will be stored in ~/.config/REAPER. If you want
to keep all configuration with the "reaper" executable, you can create a file
named "reaper.ini" alongside it, which will cause REAPER to use that directory.

- Installation:

If you would like to install REAPER to your system (either globally in /opt,
or in ~/opt) and/or integrate with the desktop environment, you can run the
included "install-reaper.sh" script from the terminal. It will offer you
choices on how to proceed. If you choose to install REAPER, the script will
also generate an uninstall script in order to remove it at a later date.

- Upgrading old versions of REAPER:

You can always install a new version of REAPER over the old version, there is
no need to remove the old version first.


--------------------------------------------------------------------------------

Building libSwell.so, if needed:

This version of REAPER uses libSwell.so, which by default targets libgdk-3. You
can build your own version if you wish to make a headless REAPER install, or if
you would like to target libgdk-2, or if you want to customize and/or improve
libSwell!

To build libSwell:

# apt-get install build-essential libgtk-3-dev git

git clone http://www-dev.cockos.com/wdl/WDL.git WDL/
cd WDL/WDL/swell
make

Options for make:
  NOGDK=1             -- for a headless build

  GDK2=1              -- to build targetting gdk2

  ALLOW_WARNINGS=1    -- ignore warnings (probably needed for some versions
                         of gcc)

  PRELOAD_GDK=1       -- not necessary for custom libSwell builds (used for
                         the stock libSwell, allowing compatibility with
                         various minor GDK versions), causes reaper to
                         preload GDK before loading libSwell.
                         This (unrelated to design) seems to fix GDK issues
                         with some incorrectly-linked plug-ins.

  SWELL_SUPPORT_GTK=1 -- Load and initialize full GTK+ rather than just GDK.
                         This fixes compatibility issues with some plug-ins
                         that use GTK+3, but prevents using GTK+2 plug-ins.

  NOFONTCONFIG=1      -- Use internal fontmapper rather than libfontconfig


Once your make succeeds, you can do (replace ~/reaper_linux_x86_64/REAPER/ with the actual path)

ln -sf `pwd`/libSwell.so ~/reaper_linux_x86_64/REAPER/libSwell.so


