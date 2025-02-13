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
    hash = "sha256-EI6bZaGVeWKVUe+l+oc2JbfxoY3RE7QVmv7r2LF/uQ4=";
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
  ];
})

