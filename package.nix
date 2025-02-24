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

let
  fs = lib.fileset;
  sourceFiles = fs.intersection
    (fs.gitTracked ./.)
    (fs.unions [
      ./main
      ./common
    ]);
in

stdenv.mkDerivation (finalAttrs: {
  pname = "puchi-sekai";
  version = "0.0.1";

  src = fs.toSource {
    root = ./.;
    fileset = sourceFiles;
  };

  pnpmDeps = pnpm.fetchDeps {
    inherit (finalAttrs) pname version src;
    sourceRoot = "${finalAttrs.src.name}/main";
    hash = "sha256-8UJOuh5QNrXWdsKFsXnb0U72COTDTU1Rm7IN9RTfl68=";
  };
  pnpmRoot = "main";

  cargoDeps = rustPlatform.fetchCargoVendor {
    inherit (finalAttrs)
      pname
      version
      src
      cargoRoot
      ;
    hash = "sha256-G8NYSnCXfqJ1KBF16Q1TeR65XXaHnIw2gQiaTXFwt+o=";
  };

  cargoRoot = "main/src-tauri";

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

