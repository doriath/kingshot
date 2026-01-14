{
  description = "Flake for kingshot";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    rust-overlay.url = "github:oxalica/rust-overlay";
    flake-utils.url = "github:numtide/flake-utils";
    antigravity-nix.url = "github:jacopone/antigravity-nix";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      rust-overlay,
      antigravity-nix,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };
        rust = pkgs.rust-bin.stable.latest.default.override { targets = [ "wasm32-unknown-unknown" ]; };
        rustPlatform = pkgs.recurseIntoAttrs (
          pkgs.makeRustPlatform {
            rustc = rust;
            cargo = rust;
          }
        );
      in
      rec {
        formatter = pkgs.nixpkgs-fmt;

        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.bashInteractive
            pkgs.rust-analyzer
            pkgs.nodejs_20
            pkgs.wasm-pack
            pkgs.gcc
            rust
            antigravity-nix.packages.${system}.default
          ];
        };
      }
    );
}
