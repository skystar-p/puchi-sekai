{ lib
, rustPlatform
,
}:

rustPlatform.buildRustPackage rec {
  pname = "puchi-sekai-ipc";
  version = "0.0.1";

  src = lib.cleanSource ./.;

  buildAndTestSubdir = "ipc";
  cargoRoot = "ipc";

  useFetchCargoVendor = true;

  cargoDeps = rustPlatform.fetchCargoVendor {
    inherit
      pname
      version
      src
      cargoRoot
      ;
    hash = "sha256-urEx6y70JC1Yvw/WdihUq8YCAQDMU/QKTyFkGWirK34=";
  };
}
