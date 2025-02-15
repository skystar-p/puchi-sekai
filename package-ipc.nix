{ lib
, rustPlatform
,
}:


rustPlatform.buildRustPackage {
  pname = "puchi-sekai-ipc";
  version = "0.0.1";

  src = lib.cleanSource ./.;

  buildAndTestSubdir = "ipc";

  useFetchCargoVendor = true;
  cargoHash = "sha256-/srWdDfwawiQz90W5r2GhmqHeRJvbmVAjZp0QhJRsyM=";
}
