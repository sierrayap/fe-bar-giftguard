import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Input,
  useGenieChat,
} from '@databricks/appkit-ui/react';
import { useMemo, useState } from 'react';

const STARTER_QUESTIONS = [
  'What was the fraud rate by brand last week?',
  'Show the top 10 highest-value blocked orders yesterday.',
  'How much fraud $ did we block this month vs last?',
];

export function GeniePanel({ configured, analystEmail }: { configured: boolean; analystEmail: string | null }) {
  if (!configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ask Genie</CardTitle>
          <CardDescription>Natural-language analytics over gold fraud tables</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Genie space not bound</EmptyTitle>
              <EmptyDescription>
                Set DATABRICKS_GENIE_SPACE_ID from the fe-bar-genie-space app resource, then restart the app.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return <GenieChatBody analystEmail={analystEmail} />;
}

function GenieChatBody({ analystEmail }: { analystEmail: string | null }) {
  const [draft, setDraft] = useState('');
  const chat = useGenieChat({ alias: 'default' });
  const lastSql = useMemo(() => {
    for (const message of [...chat.messages].reverse()) {
      for (const attachment of message.attachments ?? []) {
        if (attachment.query?.query) return attachment.query;
      }
    }
    return null;
  }, [chat.messages]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Ask Genie</CardTitle>
            <CardDescription>Questions run on-behalf-of the signed-in user via dashboards.genie</CardDescription>
          </div>
          <Badge variant="secondary">{analystEmail ?? 'Signed in'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          AI-generated from gold fraud tables via Genie — review the generated SQL before trusting results.
        </p>
        <div className="flex flex-wrap gap-2">
          {STARTER_QUESTIONS.map((question) => (
            <Button key={question} size="sm" variant="outline" onClick={() => chat.sendMessage(question)}>
              {question}
            </Button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            chat.sendMessage(text);
            setDraft('');
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about fraud rate, blocked dollars, or brands"
          />
          <Button type="submit" disabled={chat.status === 'streaming'}>
            Ask
          </Button>
        </form>
        {chat.status === 'streaming' && <p className="text-sm text-muted-foreground">Analyzing your data…</p>}
        {chat.status === 'error' && (
          <Alert variant="destructive">
            <AlertDescription>{chat.error ?? 'Genie failed — rephrase or retry.'}</AlertDescription>
          </Alert>
        )}
        <div className="max-h-[360px] space-y-3 overflow-auto">
          {chat.messages.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No questions yet</EmptyTitle>
                <EmptyDescription>Start with a starter question or type your own.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {chat.messages.map((message) => (
            <div key={message.id} className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{message.role}</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>
              {message.role === 'assistant' && (
                <p className="mt-2 text-xs text-muted-foreground">AI-generated — verify against the SQL below.</p>
              )}
            </div>
          ))}
        </div>
        {lastSql && (
          <Card>
            <CardHeader>
              <CardTitle>Generated SQL</CardTitle>
              <CardDescription>{lastSql.title ?? 'How this answer was computed'}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto text-xs">{lastSql.query}</pre>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
