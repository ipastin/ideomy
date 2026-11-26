import { fromMarkdown, type Options, type Token } from "mdast-util-from-markdown";

type Syntax = NonNullable<Options["extensions"]>[number];
type Construct = NonNullable<NonNullable<Syntax["flow"]>[37]>;
type Comment = { start: number; end: number; block: boolean };

const blockComment = "ideomyBlockComment" as Token["type"];
const inlineComment = "ideomyInlineComment" as Token["type"];
const commentData = "ideomyCommentData" as Token["type"];
const percent = 37;
const backslash = 92;

function commentConstruct(block: boolean): Construct {
  return {
    concrete: block,
    tokenize(effects, ok, nok) {
      type Code = Parameters<typeof ok>[0];
      type Next = ReturnType<typeof ok>;
      const token = block ? blockComment : inlineComment;
      // Micromark represents CR, LF and CRLF with codes below its whitespace tokens.
      const lineEnding = (code: Code): boolean => code !== null && code < -2;
      const interrupt = block && this.interrupt;
      const flow = this.parser.constructs.flow;
      let dataOpen = false;
      let tailIndent = 0;

      function start(code: Code) {
        effects.enter(token);
        effects.enter(commentData);
        dataOpen = true;
        effects.consume(code);
        return open;
      }
      function open(code: Code) {
        if (code !== percent) return nok(code);
        effects.consume(code);
        return interrupt ? finish : inside;
      }
      function inside(code: Code): Next {
        if (code === null) return block ? finish(code) : nok(code);
        if (lineEnding(code)) {
          if (!block) return nok(code);
          closeData();
          effects.enter("lineEnding");
          effects.consume(code);
          effects.exit("lineEnding");
          return nextLine;
        }
        effects.consume(code);
        if (code === backslash) return escaped;
        return code === percent ? close : inside;
      }
      function escaped(code: Code): Next {
        if (code === null || lineEnding(code)) return inside(code);
        effects.consume(code);
        return inside;
      }
      function close(code: Code) {
        if (code !== percent) return inside(code);
        effects.consume(code);
        return finish;
      }
      function closeData(): void {
        if (dataOpen) effects.exit(commentData);
        dataOpen = false;
      }
      function nextLine(code: Code): Next {
        if (code !== null && !lineEnding(code)) {
          effects.enter(commentData);
          dataOpen = true;
        }
        return inside(code);
      }
      function finish(code: Code) {
        closeData();
        effects.exit(token);
        if (!block || interrupt || code === null || lineEnding(code)) return ok(code);
        if (code !== 32) return resumeFlow(code);
        effects.enter("linePrefix");
        return indentTail(code);
      }
      function indentTail(code: Code): Next {
        if (code === 32 && tailIndent < 3) {
          tailIndent++;
          effects.consume(code);
          return indentTail;
        }
        effects.exit("linePrefix");
        return resumeFlow(code);
      }
      function resumeFlow(code: Code): Next {
        if (code === null || lineEnding(code)) return ok(code);
        // A fence or other Markdown block may start immediately after a closing comment.
        return effects.attempt(flow, ok, startTail)(code);
      }
      function startTail(code: Code): Next {
        effects.enter("chunkText", { contentType: "text" });
        return tail(code);
      }
      function tail(code: Code) {
        if (code === null || lineEnding(code)) {
          effects.exit("chunkText");
          return ok(code);
        }
        effects.consume(code);
        return tail;
      }
      return start;
    },
  };
}

const syntax: Syntax = {
  flow: { [percent]: commentConstruct(true) },
  text: { [percent]: commentConstruct(false) },
};

export function obsidianComments(body: string): Comment[] {
  const comments: Comment[] = [];
  const collect = (token: Token, block: boolean) => {
    comments.push({ start: token.start.offset, end: token.end.offset, block });
  };
  fromMarkdown(body, {
    extensions: [syntax],
    mdastExtensions: [
      { exit: { [blockComment]: (token) => collect(token, true), [inlineComment]: (token) => collect(token, false) } },
    ],
  });
  return comments;
}
