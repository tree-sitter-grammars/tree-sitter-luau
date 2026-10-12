/**
 * @file Luau grammar for tree-sitter
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @license MIT
 */


/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const lua = require('@muniftanjim/tree-sitter-lua/grammar');

const PREC = {
  ASSIGN: 0,
  OR: 1, // or
  AND: 2, // and
  COMPARE: 3, // < > <= >= ~= ==
  BIT_OR: 4, // |
  BIT_NOT: 5, // ~
  BIT_AND: 6, // &
  BIT_SHIFT: 7, // << >>
  CONCAT: 8, // ..
  PLUS: 9, // + -
  MULTI: 10, // * / // %
  CAST: 11, // ::
  UNARY: 12, // not # -
  POWER: 13, // ^
};

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return sep1(rule, ',');
}

/**
 * Creates a rule to match zero or more of the rules separated by a comma
 *
 * @param {Rule} rule
 * @returns {ChoiceRule}
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
 * Creates a rule to match one or more occurrences of `rule` separated by `sep`
 *
 * @param {RegExp | Rule | string} rule
 *
 * @param {RegExp | Rule | string} sep
 *
 * @returns {SeqRule}
 */
function sep1(rule, sep) {
  return seq(rule, repeat(seq(sep, rule)));
}


/**
 * Creates a rule to match two or more occurrences of `rule` separated by `sep`
 *
 * @param {RegExp | Rule | string} rule
 *
 * @param {RegExp | Rule | string} sep
 *
 * @returns {SeqRule}
 */
function sep2(rule, sep) {
  return seq(rule, repeat1(seq(sep, rule)));
}

/**
 * Creates a rule to match one or more of the rules separated by a comma or semicolon (Luau fieldsep)
 *
 * @param {Rule} rule
 *
 * @returns {SeqRule}
 */
function fieldsepSep1(rule) {
  return seq(rule, repeat(seq(choice(',', ';'), rule)));
}

/**
 * @param {GrammarSymbols<string>} $
 */
const optional_block = $ => alias(optional($._block), $.block);

module.exports = grammar(lua, {
  name: 'luau',

  supertypes: ($, original) => original.concat([
    $.type,
  ]),

  rules: {
    // Luau has no goto and label statements, and has continue statements
    statement: ($, original) => choice(
      ...original.members.filter(
        member => member.name !== 'goto_statement' && member.name !== 'label_statement',
      ),
      $.update_statement,
      $.continue_statement,
      $.type_definition,
      $.type_function,
      $.declare_statement,
      $.const_statement,
    ),

    const_statement: $ => choice(
      seq(
        repeat($.attribute),
        'const',
        'function',
        field('name', $.identifier),
        $._function_body,
      ),
      seq('const', alias($._local_variable_assignment, $.assignment_statement)),
    ),

    function_declaration: ($) =>
      seq(repeat($.attribute), 'function', field('name', $._function_name), $._function_body),
    _local_function_declaration: ($) =>
      seq(repeat($.attribute), 'local', 'function', field('name', $.identifier), $._function_body),

    function_definition: ($) => seq(repeat($.attribute), 'function', $._function_body),

    attribute: $ => choice(
      seq('@', field('attribute_name', alias(token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/), $.identifier))),
      seq('@[', commaSep1($.parattr), ']'),
    ),

    parattr: $ => seq(
      field('attribute_name', $.identifier),
      optional($.attribute_arguments),
    ),

    attribute_arguments: $ => choice(
      seq('(', optional(commaSep1($._attribute_literal)), ')'),
      $._attribute_littable,
      $.string,
    ),

    _attribute_literal: $ => choice(
      'nil',
      'false',
      'true',
      $.number,
      $.string,
      $._attribute_littable,
    ),

    _attribute_littable: $ => seq(
      '{',
      optional(seq(
        $._attribute_litfield,
        repeat(seq(choice(',', ';'), $._attribute_litfield)),
        optional(choice(',', ';')),
      )),
      '}',
    ),

    _attribute_litfield: $ => seq(
      optional(seq($.identifier, '=')),
      $._attribute_literal,
    ),

    update_statement: $ => seq(
      alias($._variable_assignment_varlist, $.variable_list),
      choice('+=', '-=', '*=', '/=', '%=', '//=', '^=', '..='),
      alias($._variable_assignment_explist, $.expression_list),
    ),

    continue_statement: _ => 'continue',

    type_definition: $ => seq(
      optional('export'),
      'type',
      field('name', $.identifier),
      optional(field('generic_parameters', $.generic_type_list_with_defaults)),
      '=',
      $.type,
    ),

    type_function: $ => seq(
      optional('export'),
      'type',
      'function',
      field('name', $.identifier),
      $._function_body,
    ),

    generic_type_list_with_defaults: $ => seq(
      '<',
      commaSep1($._generic_type_parameter),
      '>',
    ),
    _generic_type_parameter: $ => choice(
      seq($.identifier, optional(seq('=', $.type))),
      seq($.identifier, $.vararg_expression, optional(seq('=', $.type))),
    ),

    declare_statement: $ => choice(
      seq(
        repeat($.attribute),
        'declare',
        'function',
        field('name', $.identifier),
        optional($.generic_type_list),
        field('parameters', $.parameters),
        optional(seq(':', $.type)),
      ),
      seq(
        'declare',
        'extern',
        'type',
        field('name', $.identifier),
        optional(seq('extends', field('super', $.type))),
        optional('with'),
        repeat($.declare_member),
        'end',
      ),
      seq(
        'declare',
        'class',
        field('name', $.identifier),
        optional(seq('extends', field('super', $.type))),
        repeat($.declare_member),
        'end',
      ),
      seq(
        'declare',
        field('name', $.identifier),
        ':',
        field('type', $.type),
      ),
    ),

    declare_member: $ => choice(
      seq(
        optional(repeat($.attribute)),
        'function',
        field('name', $.identifier),
        field('parameters', $.parameters),
        optional(seq(':', $.type)),
      ),
      seq(
        optional(field('access_qualifier', choice('read', 'write'))),
        choice($.identifier, $.object_field_type),
        ':',
        $.type,
      ),
    ),

    _function_body: $ => seq(
      optional($.generic_type_list),
      field('parameters', $.parameters),
      optional(seq(':', $.type)),
      field('body', optional_block($)),
      'end',
    ),
    generic_type_list: $ => seq(
      '<',
      commaSep1(
        seq($.identifier, optional($.vararg_expression)),
      ),
      '>',
    ),
    _parameter_list: $ => choice(commaSep1($.parameter)),

    parameter: $ => seq(
      choice($.identifier, $.vararg_expression),
      optional(seq(':', $.type)),
    ),

    _att_name_list: $ => sep1(
      seq(
        field('name', $.identifier),
        optional(seq(':', $.type)),
        optional(field('attribute', alias($._attrib, $.attribute))),
      ),
      ',',
    ),

    type: $ => choice(
      prec.right($.identifier),
      $.builtin_type,
      $.tuple_type,
      $.function_type,
      $.generic_type,
      $.generic_type_pack,
      $.object_type,
      $.empty_type,
      $.field_type,
      $.intersection_type,
      $.union_type,
      $.optional_type,
      $.literal_type,
      $.variadic_type,
      $.typeof_type,
    ),

    typeof_type: $ => seq('typeof', '(', $.expression, ')'),

    builtin_type: _ => choice(
      'thread',
      'buffer',
      'any',
      'userdata',
      'unknown',
      'never',
      'string',
      'number',
      'table',
      'boolean',
      'nil',
    ),

    tuple_type: $ => seq('(', commaSep1($.type), ')'),

    function_type: $ => prec.right(seq(
      '(',
      choice(
        seq(commaSep(seq($.identifier, ':', $.type)), optional(seq(',', commaSep($.type)))),
        commaSep($.type),
      ),
      ')',
      '->',
      $.type,
    )),

    generic_type: $ => seq(
      $.type,
      token(prec(1, '<')),
      commaSep($.type),
      '>',
    ),

    generic_type_pack: $ => seq($.identifier, '...'),

    object_type: $ => seq(
      '{',
      optional(choice(
        fieldsepSep1(seq(
          optional(field('access_qualifier', choice('read', 'write'))),
          choice($.identifier, $.object_field_type),
          ':',
          $.type,
        )),
        fieldsepSep1($.type),
      )),
      optional(choice(',', ';')),
      '}',
    ),

    empty_type: _ => seq('(', ')'),

    field_type: $ => sep2($.identifier, '.'),

    object_field_type: $ => seq('[', $.type, ']'),

    union_type: $ => prec.left(1, seq($.type, '|', $.type)),

    intersection_type: $ => prec.left(2, seq($.type, '&', $.type)),

    optional_type: $ => seq($.type, '?'),

    literal_type: $ => choice($.string, $.true, $.false),

    variadic_type: $ => prec.right(seq('...', $.type)),

    expression: ($, original) => choice(
      original,
      $.cast_expression,
      $.if_expression,
    ),

    // Luau has no bitwise operators
    binary_expression: $ => choice(
      ...[
        ['or', PREC.OR],
        ['and', PREC.AND],
        ['<', PREC.COMPARE],
        ['<=', PREC.COMPARE],
        ['==', PREC.COMPARE],
        ['~=', PREC.COMPARE],
        ['>=', PREC.COMPARE],
        ['>', PREC.COMPARE],
        ['+', PREC.PLUS],
        ['-', PREC.PLUS],
        ['*', PREC.MULTI],
        ['/', PREC.MULTI],
        ['//', PREC.MULTI],
        ['%', PREC.MULTI],
      ].map(([operator, precedence]) =>
        prec.left(
          precedence,
          seq(
            field('left', $.expression),
            // @ts-ignore
            operator,
            field('right', $.expression),
          ),
        ),
      ),
      ...[
        ['..', PREC.CONCAT],
        ['^', PREC.POWER],
      ].map(([operator, precedence]) =>
        prec.right(
          precedence,
          seq(
            field('left', $.expression),
            // @ts-ignore
            operator,
            field('right', $.expression),
          ),
        ),
      ),
    ),

    unary_expression: ($) => prec.left(
      PREC.UNARY,
      seq(choice('not', '#', '-'), field('operand', $.expression)),
    ),

    cast_expression: $ => prec(PREC.CAST, seq(
      $.expression,
      '::',
      $.type,
    )),

    if_expression: $ => prec.right(seq(
      'if',
      field('condition', $.expression),
      'then',
      field('consequence', $.expression),
      repeat($.elseif_clause),
      optional($.else_clause),
    )),

    elseif_clause: $ => seq(
      'elseif',
      field('condition', $.expression),
      'then',
      field('consequence', $.expression),
    ),

    else_clause: $ => seq(
      'else',
      field('consequence', $.expression),
    ),

    _binding_list: $ => commaSep1(seq(
      field('name', $.identifier),
      optional(seq(':', $.type)),
    )),


    for_generic_clause: ($) => seq(
      alias($._binding_list, $.variable_list),
      'in',
      alias($._expression_list, $.expression_list),
    ),

    // Luau can have hex and binary numbers, with the 0x and 0b prefixes, and can have underscores
    number: _ => {
      const decimal_digits = /[0-9][0-9_]*/;
      const signed_integer = seq(optional(choice('-', '+')), decimal_digits);
      const decimal_exponent_part = seq(choice('e', 'E'), signed_integer);

      const hex_digits = /[a-fA-F0-9][a-fA-F0-9_]*/;
      const hex_exponent_part = seq(choice('p', 'P'), signed_integer);

      const binary_digits = /[0-1][0-1_]*/;

      const decimal_literal = choice(
        seq(
          decimal_digits,
          '.',
          optional(decimal_digits),
          optional(decimal_exponent_part),
        ),
        seq('.', decimal_digits, optional(decimal_exponent_part)),
        seq(decimal_digits, optional(decimal_exponent_part)),
      );

      const hex_literal = seq(
        choice('0x', '0X'),
        hex_digits,
        optional(seq('.', hex_digits)),
        optional(hex_exponent_part),
      );

      const binary_literal = seq(
        choice('0b', '0B'),
        binary_digits,
      );

      return token(choice(decimal_literal, hex_literal, binary_literal));
    },

    string: ($, original) => choice(
      original,
      $._interpolated_string,
    ),

    _interpolated_string: $ => seq(
      '`',
      repeat(choice(
        field('content', alias($._interpolation_string_content, $.string_content)),
        $._escape_sequence,
        $.interpolation,
      )),
      '`',
    ),

    _interpolation_string_content: _ => choice(token.immediate(prec(1, /[^`\{\\]+/)), '\\{'),

    _escape_sequence: $ => choice(
      prec(2, token.immediate(seq('\\', /[^abfnrtvxu'\"\\\?]/))),
      prec(1, $.escape_sequence),
    ),

    escape_sequence: _ => token.immediate(seq(
      '\\',
      choice(
        /[^xu0-7]/,
        /[0-7]{1,3}/,
        /x[0-9a-fA-F]{2}/,
        /u[0-9a-fA-F]{4}/,
        /u\{[0-9a-fA-F]+\}/,
        /U[0-9a-fA-F]{8}/,
      ),
    )),

    interpolation: $ => seq('{', $.expression, '}'),

    // Name
    identifier: _ => {
      const identifier_start =
        /[^\p{Control}\s+\-*/%^#&~|<>=(){}\[\];:,.\\'"`?@\d]/u;
      const identifier_continue =
        /[^\p{Control}\s+\-*/%^#&~|<>=(){}\[\];:,.\\'"`?@]*/u;
      return token(seq(identifier_start, identifier_continue));
    },
  },
});
