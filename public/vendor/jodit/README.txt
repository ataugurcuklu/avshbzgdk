Place your custom Jodit UMD/ES5 build files in this folder.
Expected filenames (adjustable in loader):
- jodit.custom.js  (UMD/ES5 JS that exposes window.Jodit)
- jodit.custom.css (matching CSS)

If you already replaced files in node_modules, copy them here for stable dev serving:
Copy-Item -Path .\node_modules\jodit\build\jodit.min.js -Destination .\public\vendor\jodit\jodit.custom.js -Force
Copy-Item -Path .\node_modules\jodit\build\jodit.min.css -Destination .\public\vendor\jodit\jodit.custom.css -Force
