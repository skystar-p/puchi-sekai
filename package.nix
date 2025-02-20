{ lib
, stdenv
, rustPlatform
, pnpm
, nodejs
, cargo-tauri
, pkg-config
, wrapGAppsHook4
, openssl
, webkitgtk_4_1
, gtk-layer-shell
,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "puchi-sekai";
  version = "0.0.1";

  src = lib.cleanSource ./.;

  pnpmDeps = pnpm.fetchDeps {
    inherit (finalAttrs) pname version src;
    hash = "sha256-8UJOuh5QNrXWdsKFsXnb0U72COTDTU1Rm7IN9RTfl68=";
  };

  cargoDeps = rustPlatform.fetchCargoVendor {
    inherit (finalAttrs)
      pname
      version
      src
      cargoRoot
      ;
    hash = "sha256-UyK1Ly5/+wo7bDYxl/s/b0hEf1545ifpfw6j0/nBNUM=";
  };

  cargoRoot = "src-tauri";

  buildAndTestSubdir = finalAttrs.cargoRoot;

  nativeBuildInputs = [
    nodejs
    pnpm.configHook
    rustPlatform.cargoSetupHook
    cargo-tauri.hook
    rustPlatform.cargoCheckHook
    pkg-config
    wrapGAppsHook4
  ];

  buildInputs = [
    webkitgtk_4_1
    openssl
    gtk-layer-shell
  ];
})

