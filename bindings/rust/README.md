# tree-sitter-luau

This crate provides a Luau grammar for the [tree-sitter][] parsing library. To
use this crate, add it to the `[dependencies]` section of your `Cargo.toml`
file. (Note that you will probably also need to depend on the
[`tree-sitter`][tree-sitter crate] crate to use the parsed result in any useful
way.)

```toml
[dependencies]
tree-sitter = "~0.20.3"
tree-sitter-luau = "1.0.0"
```

Typically, you will use the [language][language func] function to add this
grammar to a tree-sitter [Parser][], and then use the parser to parse some code:

```rust
let code = r#"
function foo(x: number, y: string): boolean
    local k = (y :: string):rep(x)
    local foo: (number, string) -> boolean

    local no_returns: (number, string) -> ()
    local returns_boolean_and_string: (number, string) -> (boolean, string)

    local a = "hi"
    local b = `bye {no_returns}`
end

export type Point = {
    x: number,
    y: number,
}
"#;
let mut parser = Parser::new();
parser.set_language(tree_sitter_luau::language()).expect("Error loading Luau grammar");
let parsed = parser.parse(code, None);
```

If you have any questions, please reach out to us in the [tree-sitter
discussions] page.

[language func]: https://docs.rs/tree-sitter-luau/*/tree_sitter_luau/fn.language.html
[parser]: https://docs.rs/tree-sitter/*/tree_sitter/struct.Parser.html
[tree-sitter]: https://tree-sitter.github.io/
[tree-sitter crate]: https://crates.io/crates/tree-sitter
[tree-sitter discussions]: https://github.com/tree-sitter/tree-sitter/discussions
