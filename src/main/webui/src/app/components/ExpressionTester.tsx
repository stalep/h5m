import {
  Button,
  CodeSnippet,
  Column,
  Dropdown,
  Grid,
  InlineLoading,
  Tag,
  TextArea,
} from '@carbon/react';
import { useCallback, useMemo, useState } from 'react';

const EXPRESSION_TYPES = [
  { id: 'jq', text: 'jq' },
  { id: 'js', text: 'JavaScript' },
];

/**
 * Returns a jq-safe key accessor. Keys with special characters
 * (hyphens, dots, spaces, etc.) are quoted: ."my-key"
 */
function jqKey(key: string): string {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? '.' + key : '."' + key + '"';
}

/**
 * Recursively extracts all jq dot-notation paths from a JSON object.
 * Keys with special characters are automatically quoted.
 * E.g., {"a": {"b-c": 1}} yields [".a", '.a."b-c"']
 */
function extractPaths(obj: unknown, prefix = ''): string[] {
  if (obj == null || typeof obj !== 'object') return [];
  const paths: string[] = [];
  if (Array.isArray(obj)) {
    paths.push(prefix + '[]');
    if (obj.length > 0) {
      extractPaths(obj[0], prefix + '[]').forEach((p) => paths.push(p));
    }
  } else {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      const path = prefix + jqKey(key);
      paths.push(path);
      extractPaths((obj as Record<string, unknown>)[key], path).forEach((p) => paths.push(p));
    }
  }
  return paths;
}

export interface CreateNodeRequest {
  expression: string;
  type: string;
}

interface ExpressionTesterProps {
  /** The value ID to evaluate against */
  valueId: number;
  /** The JSON data of the upload, used for autocomplete suggestions */
  data?: unknown;
  /** Called when user clicks "Create node" with a successful expression */
  onCreateNode?: (request: CreateNodeRequest) => void;
}

export const ExpressionTester = ({ valueId, data, onCreateNode }: ExpressionTesterProps) => {
  const [expression, setExpression] = useState('.');
  const [type, setType] = useState('jq');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Extract all paths from the data for autocomplete
  const allPaths = useMemo(() => (data ? extractPaths(data) : []), [data]);

  // Filter suggestions based on current expression
  const suggestions = useMemo(() => {
    if (type !== 'jq' || !expression || allPaths.length === 0) return [];
    // Get the last path segment the user is typing
    // For expressions like ".config.Q", match against full paths starting with ".config.Q"
    const trimmed = expression.trim();
    if (!trimmed.startsWith('.')) return [];
    return allPaths
      .filter((p) => p.startsWith(trimmed) && p !== trimmed)
      .slice(0, 8); // limit suggestions
  }, [expression, allPaths, type]);

  const evaluate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ valueId: String(valueId), type });
      const response = await fetch(`/api/expression/try?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: expression,
      });
      const text = await response.text();
      if (!response.ok) {
        setError(text || `HTTP ${String(response.status)}`);
      } else {
        try {
          setResult(JSON.stringify(JSON.parse(text), null, 2));
        } catch {
          setResult(text);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  }, [expression, type, valueId]);

  return (
    <div style={{ padding: 'var(--cds-spacing-03)' }}>
      <Grid condensed>
        <Column lg={12} md={6} sm={4}>
          <div style={{ display: 'flex', gap: 'var(--cds-spacing-03)', alignItems: 'flex-end', marginBottom: 'var(--cds-spacing-03)' }}>
            <Dropdown
              id="expression-type"
              titleText="Type"
              label="Select type"
              items={EXPRESSION_TYPES}
              itemToString={(item: { id: string; text: string } | null) => item?.text ?? ''}
              selectedItem={EXPRESSION_TYPES.find((t) => t.id === type)}
              onChange={({ selectedItem }: { selectedItem: { id: string } | null }) => {
                if (selectedItem) setType(selectedItem.id);
              }}
              size="sm"
              style={{ minWidth: '140px' }}
            />
            <Button size="sm" onClick={() => void evaluate()} disabled={loading || !expression.trim()}>
              {loading ? 'Evaluating...' : 'Run'}
            </Button>
          </div>
        </Column>
        <Column lg={12} md={6} sm={4}>
          <TextArea
            id="expression-input"
            labelText="Expression"
            placeholder={type === 'jq' ? '.results.cpu' : '(input) => input.results.cpu'}
            value={expression}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setExpression(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              // Tab to accept first suggestion
              if (e.key === 'Tab' && suggestions.length > 0) {
                e.preventDefault();
                setExpression(suggestions[0] ?? expression);
              }
              // Enter to evaluate (without Shift for multi-line)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (expression.trim()) void evaluate();
              }
            }}
            rows={3}
          />
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
              {suggestions.map((s) => (
                <Tag
                  key={s}
                  size="sm"
                  type="blue"
                  onClick={() => setExpression(s)}
                  style={{ cursor: 'pointer' }}
                >
                  {s}
                </Tag>
              ))}
            </div>
          )}
        </Column>
        <Column lg={12} md={6} sm={4} style={{ marginTop: 'var(--cds-spacing-03)' }}>
          {loading && <InlineLoading description="Evaluating..." />}
          {error && (
            <div style={{ color: 'var(--cds-support-error)', padding: 'var(--cds-spacing-03)' }}>
              {error}
            </div>
          )}
          {result && (
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: 'var(--cds-spacing-02)' }}>Result</div>
              <CodeSnippet type="multi" wrapText>
                {result}
              </CodeSnippet>
              <div style={{ marginTop: 'var(--cds-spacing-03)' }}>
                <Button
                  size="sm"
                  kind="tertiary"
                  onClick={() => onCreateNode?.({ expression, type })}
                  disabled={!onCreateNode}
                >
                  Create node from this expression
                </Button>
              </div>
            </div>
          )}
        </Column>
      </Grid>
    </div>
  );
};

// Export for testing
export { extractPaths, jqKey };
