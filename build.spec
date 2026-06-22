# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from pathlib import Path

block_cipher = None

# Use project root directory
spec_dir = os.path.dirname(os.path.abspath(SPECPATH)) if "SPECPATH" in dir() else os.getcwd()

# --- Paths ---
site_packages = os.path.join(
    os.path.dirname(sys.executable), "..",
    "lib", f"python{sys.version_info.major}.{sys.version_info.minor}",
    "site-packages",
)
site_packages = os.path.abspath(site_packages)

# CustomTkinter assets
ctk_dir = os.path.join(site_packages, "customtkinter")
ctk_assets = os.path.join(ctk_dir, "assets")

# Playwright driver (Node.js + CLI)
playwright_dir = os.path.join(site_packages, "playwright")

# --- Data files ---
datas = []

# CustomTkinter theme assets
if os.path.exists(ctk_assets):
    datas.append((ctk_assets, "customtkinter/assets"))

# Playwright driver (Node.js + package)
if os.path.exists(playwright_dir):
    driver_path = os.path.join(playwright_dir, "driver")
    if os.path.exists(driver_path):
        datas.append((driver_path, "playwright/driver"))

# --- Hidden imports ---
hiddenimports = [
    "pandas",
    "pandas._libs",
    "pandas._libs.tslibs",
    "pandas._libs.tslibs.np_datetime",
    "pandas._libs.tslibs.nattype",
    "pandas._libs.tslibs.timedeltas",
    "pandas._libs.tslibs.timezones",
    "pandas._libs.tslibs.base",
    "pandas.compat",
    "pandas.compat.pickle_compat",
    "openpyxl",
    "openpyxl.cell",
    "openpyxl.reader",
    "openpyxl.reader.excel",
    "openpyxl.writer",
    "openpyxl.writer.excel",
    "openpyxl.styles",
    "openpyxl.utils",
    "playwright",
    "playwright.sync_api",
    "playwright.async_api",
    "playwright._impl",
    "lxml",
    "lxml._elementpath",
    "lxml.etree",
    "html5lib",
    "jinja2",
    "dateutil",
    "dateutil.parser",
    "dateutil.tz",
    "pytz",
]

# --- Binaries ---
binaries = []

# --- Excludes ---
excludes = [
    "tkinter.test",
    "unittest",
    "email",
    "http",
    "urllib",
    "pydoc",
    "distutils",
]

# --- Analysis ---
a = Analysis(
    ["main.py"],
    pathex=[spec_dir],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="SAT XML Conversor",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

app = BUNDLE(
    exe,
    name="SAT XML Conversor.app",
    icon=None,
    bundle_identifier="com.xml-conversor.app",
    info_plist={
        "NSHighResolutionCapable": "True",
        "CFBundleDisplayName": "SAT XML Conversor",
        "CFBundleName": "SAT XML Conversor",
        "CFBundleVersion": "1.0.0",
        "CFBundleShortVersionString": "1.0.0",
        "CFBundleExecutable": "SAT XML Conversor",
        "NSRequiresAquaSystemAppearance": "False",
    },
)
