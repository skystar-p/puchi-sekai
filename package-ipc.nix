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
    hash = "sha256-rsf9xLmkLRo4JvZDb4PGWrjYHkUg/wjlG9kgx0Ee1nM=";
  };
}
