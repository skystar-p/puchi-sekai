{
  description = "puchi-sekai";

  inputs = {
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs@{ nixpkgs, flake-parts, ... }: flake-parts.lib.mkFlake { inherit inputs; } {
    imports = [ ];

    systems = [
      "x86_64-linux"
      "x86_64-darwin"
      "aarch64-linux"
      "aarch64-darwin"
    ];

    perSystem = { pkgs, system, ... }:
      let
        rust-toolchain = inputs.fenix.packages.${system}.fromToolchainFile {
          file = ./rust-toolchain.toml;
          # sha256 = pkgs.lib.fakeHash;
          sha256 = "sha256-vMlz0zHduoXtrlu0Kj1jEp71tYFXyymACW8L4jzrzNA=";
        };
      in
      {
        packages.default = pkgs.callPackage ./package.nix { };
        packages.ipc = pkgs.callPackage ./package-ipc.nix { };

        devShells.default = pkgs.mkShell {
          nativeBuildInputs = with pkgs; [
            pkg-config
            gobject-introspection
            cargo-tauri
            nodejs
          ];

          buildInputs = with pkgs;[
            rust-toolchain
            at-spi2-atk
            atkmm
            cairo
            gdk-pixbuf
            glib
            gtk3
            harfbuzz
            librsvg
            libsoup_3
            pango
            webkitgtk_4_1
            openssl
          ];

          shellHook = ''
            export XDG_DATA_DIRS=${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS;
            export GIO_MODULE_DIR="${pkgs.glib-networking}/lib/gio/modules/";
          '';
        };
      };
  };
}

