export type ExpressionNode =
  | LiteralNode
  | IdentifierNode
  | UnaryNode
  | BinaryNode
  | CallNode;

export interface LiteralNode {
  type: "literal";
  value: string | number | boolean | null;
}

export interface IdentifierNode {
  type: "identifier";
  path: string[];
}

export interface UnaryNode {
  type: "unary";
  operator: "!";
  argument: ExpressionNode;
}

export interface BinaryNode {
  type: "binary";
  operator: "&&" | "||" | "==" | "!=" | ">" | ">=" | "<" | "<=";
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface CallNode {
  type: "call";
  name: string;
  args: ExpressionNode[];
}

type TokenType =
  | "identifier"
  | "number"
  | "string"
  | "boolean"
  | "null"
  | "operator"
  | "paren"
  | "comma"
  | "dot"
  | "eof";

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const twoCharOperators = new Set(["&&", "||", "==", "!=", ">=", "<="]);
const oneCharOperators = new Set(["!", ">", "<"]);

export class ExpressionSyntaxError extends Error {
  constructor(message: string, public readonly position: number) {
    super(`${message} at position ${position}`);
    this.name = "ExpressionSyntaxError";
  }
}

export function parseExpression(expression: string): ExpressionNode {
  const parser = new Parser(tokenize(expression));
  const node = parser.parse();
  parser.expect("eof");
  return node;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const two = input.slice(index, index + 2);
    if (twoCharOperators.has(two)) {
      tokens.push({ type: "operator", value: two, position: index });
      index += 2;
      continue;
    }

    if (oneCharOperators.has(char)) {
      tokens.push({ type: "operator", value: char, position: index });
      index += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char, position: index });
      index += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma", value: char, position: index });
      index += 1;
      continue;
    }

    if (char === ".") {
      tokens.push({ type: "dot", value: char, position: index });
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const start = index;
      const quote = char;
      let value = "";
      index += 1;

      while (index < input.length) {
        const next = input[index];
        if (next === "\\") {
          const escaped = input[index + 1];
          if (escaped === undefined) {
            throw new ExpressionSyntaxError("Unterminated string escape", index);
          }
          value += unescapeChar(escaped);
          index += 2;
          continue;
        }
        if (next === quote) {
          index += 1;
          tokens.push({ type: "string", value, position: start });
          break;
        }
        value += next;
        index += 1;
      }

      if (input[index - 1] !== quote) {
        throw new ExpressionSyntaxError("Unterminated string", start);
      }

      continue;
    }

    if (/[0-9]/.test(char)) {
      const start = index;
      index += 1;
      while (index < input.length && /[0-9.]/.test(input[index])) {
        index += 1;
      }
      const value = input.slice(start, index);
      if (!/^\d+(\.\d+)?$/.test(value)) {
        throw new ExpressionSyntaxError(`Invalid number "${value}"`, start);
      }
      tokens.push({ type: "number", value, position: start });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < input.length && /[A-Za-z0-9_:-]/.test(input[index])) {
        index += 1;
      }
      const value = input.slice(start, index);
      if (value === "true" || value === "false") {
        tokens.push({ type: "boolean", value, position: start });
      } else if (value === "null") {
        tokens.push({ type: "null", value, position: start });
      } else {
        tokens.push({ type: "identifier", value, position: start });
      }
      continue;
    }

    throw new ExpressionSyntaxError(`Unsupported character "${char}"`, index);
  }

  tokens.push({ type: "eof", value: "", position: input.length });
  return tokens;
}

function unescapeChar(char: string): string {
  switch (char) {
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "\\":
      return "\\";
    case "\"":
      return "\"";
    case "'":
      return "'";
    default:
      return char;
  }
}

class Parser {
  private cursor = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ExpressionNode {
    return this.parseOr();
  }

  expect(type: TokenType, value?: string): Token {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new ExpressionSyntaxError(
        `Expected ${value ?? type}, got ${token.value || token.type}`,
        token.position,
      );
    }
    this.cursor += 1;
    return token;
  }

  private parseOr(): ExpressionNode {
    let node = this.parseAnd();
    while (this.match("operator", "||")) {
      node = {
        type: "binary",
        operator: "||",
        left: node,
        right: this.parseAnd(),
      };
    }
    return node;
  }

  private parseAnd(): ExpressionNode {
    let node = this.parseComparison();
    while (this.match("operator", "&&")) {
      node = {
        type: "binary",
        operator: "&&",
        left: node,
        right: this.parseComparison(),
      };
    }
    return node;
  }

  private parseComparison(): ExpressionNode {
    let node = this.parseUnary();

    while (
      this.current().type === "operator" &&
      ["==", "!=", ">", ">=", "<", "<="].includes(this.current().value)
    ) {
      const operator = this.current().value as BinaryNode["operator"];
      this.cursor += 1;
      node = {
        type: "binary",
        operator,
        left: node,
        right: this.parseUnary(),
      };
    }

    return node;
  }

  private parseUnary(): ExpressionNode {
    if (this.match("operator", "!")) {
      return {
        type: "unary",
        operator: "!",
        argument: this.parseUnary(),
      };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.current();

    if (this.match("paren", "(")) {
      const node = this.parseOr();
      this.expect("paren", ")");
      return node;
    }

    if (token.type === "number") {
      this.cursor += 1;
      return { type: "literal", value: Number(token.value) };
    }

    if (token.type === "string") {
      this.cursor += 1;
      return { type: "literal", value: token.value };
    }

    if (token.type === "boolean") {
      this.cursor += 1;
      return { type: "literal", value: token.value === "true" };
    }

    if (token.type === "null") {
      this.cursor += 1;
      return { type: "literal", value: null };
    }

    if (token.type === "identifier") {
      return this.parseIdentifierOrCall();
    }

    throw new ExpressionSyntaxError(
      `Unexpected token ${token.value || token.type}`,
      token.position,
    );
  }

  private parseIdentifierOrCall(): ExpressionNode {
    const first = this.expect("identifier").value;

    if (this.match("paren", "(")) {
      const args: ExpressionNode[] = [];
      if (!this.match("paren", ")")) {
        do {
          args.push(this.parseOr());
        } while (this.match("comma"));
        this.expect("paren", ")");
      }
      return { type: "call", name: first, args };
    }

    const path = [first];
    while (this.match("dot")) {
      path.push(this.expect("identifier").value);
    }

    return { type: "identifier", path };
  }

  private match(type: TokenType, value?: string): boolean {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      return false;
    }
    this.cursor += 1;
    return true;
  }

  private current(): Token {
    return this.tokens[this.cursor];
  }
}
