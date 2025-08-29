# HTML to Markdown Conversion Plan for Token Optimization

## Overview

This plan outlines a comprehensive strategy to convert HTML content to Markdown format for optimal LLM token consumption. The goal is to achieve 85-90% total token reduction from original HTML while maintaining universal compatibility across different websites.

## Current State

- **Phase 1 Complete**: HTML stripping and flattening
  - Achieved: ~79% token reduction (213K chars � 45K chars)
  - Removes: Copy buttons, icons, navigation, non-essential URLs
  - Preserves: Tables, key content, mailto links, images

## Proposed Solution: Two-Stage Processing Pipeline

### Stage 1: HTML Optimization ( Complete)

Current implementation in `stripAndFlattenHTML()`:

- Remove UI elements (buttons, icons, navigation)
- Strip non-essential URLs (keep mailto: links)
- Flatten nested structures
- Normalize whitespace
- **Result**: ~79% token reduction

### Stage 2: HTML�Markdown Conversion (Proposed)

Universal pattern recognition and conversion:

- Convert HTML structures to Markdown
- Preserve semantic meaning
- Work across any website
- **Expected**: Additional 40-50% reduction (Total: 85-90%)

## Detailed Implementation Plan

### Phase 2.1: Pattern Recognition Engine

#### Universal Patterns to Detect

1. **Table Patterns**

   ```html
   <table>
     � Analyze column count and structure
   </table>
   ```

   - 2 columns without header � Key-value pairs
   - 2 columns with header � Simple table
   - 3+ columns � Full markdown table
   - Nested tables � Flatten when possible

2. **Heading Patterns**

   ```html
   <h1>
     to
     <h6>
       � # to ######
       <div class="*title*">
         � ## (inferred heading) <strong> at line start � **Bold heading**</strong>
       </div>
     </h6>
   </h1>
   ```

3. **List Patterns**

   ```html
   <ul>
     /
     <ol>
       � Bullet/numbered lists Repeated
       <div class="same">
         � Inferred list
         <dl>
           /
           <dt>/</dt>
           <dd>� Definition list</dd>
         </dl>
       </div>
     </ol>
   </ul>
   ```

4. **Key-Value Patterns**

   ```html
   <span>Label:</span><span>Value</span>
   <dt>Term</dt>
   <dd>Definition</dd>
   <td>Field</td>
   <td>Value</td>
   (in 2-col table)
   ```

5. **Content Blocks**
   ````html
   <p>� Paragraph with double newline</p>
   <blockquote>
     � > Quote
     <pre>>
   </blockquote>
   ````

### Phase 2.2: Conversion Algorithm

```javascript
class HTMLToMarkdownConverter {
  constructor(options = {}) {
    this.options = {
      preserveTables: true,
      inferHeadings: true,
      flattenNested: true,
      ...options,
    };
  }

  convert(html) {
    const doc = parseHTML(html);
    const context = this.analyzeStructure(doc);
    return this.convertElement(doc.body, context);
  }

  analyzeStructure(doc) {
    return {
      hasMultipleTables: doc.querySelectorAll('table').length > 1,
      primaryLanguage: this.detectLanguage(doc),
      documentType: this.inferDocumentType(doc),
      averageNestingDepth: this.calculateNestingDepth(doc),
    };
  }

  convertElement(element, context, depth = 0) {
    const pattern = this.detectPattern(element);
    const converter = this.converters[pattern];
    return converter ? converter(element, context, depth) : this.defaultConverter(element);
  }

  detectPattern(element) {
    // Pattern detection logic
    if (element.tagName === 'TABLE') return 'table';
    if (element.tagName.match(/^H[1-6]$/)) return 'heading';
    if (this.isListPattern(element)) return 'list';
    if (this.isKeyValuePattern(element)) return 'keyvalue';
    if (this.isContentBlock(element)) return 'content';
    return 'container';
  }

  converters = {
    table: this.convertTable,
    heading: this.convertHeading,
    list: this.convertList,
    keyvalue: this.convertKeyValue,
    content: this.convertContent,
    container: this.convertContainer,
  };
}
```

### Phase 2.3: Specific Conversion Rules

#### Table Conversion Logic

```javascript
convertTable(table) {
  const rows = Array.from(table.querySelectorAll('tr'));
  const firstRow = rows[0];
  const colCount = firstRow?.querySelectorAll('td, th').length || 0;

  // Analyze table structure
  if (colCount === 2) {
    const hasHeader = firstRow.querySelector('th') !== null;
    const looksLikeKeyValue = !hasHeader && this.isKeyValueContent(rows);

    if (looksLikeKeyValue) {
      // Convert to key-value pairs
      return rows.map(row => {
        const [key, value] = Array.from(row.querySelectorAll('td'));
        return `${this.extractText(key)}: ${this.extractText(value)}`;
      }).join('\n');
    }
  }

  // Convert to markdown table
  return this.toMarkdownTable(rows);
}
```

#### Smart Text Extraction

```javascript
extractText(element) {
  // Remove all HTML tags but preserve structure hints
  let text = element.textContent.trim();

  // Handle special cases
  if (element.querySelector('a[href^="mailto:"]')) {
    // Preserve email links as plain text
    const email = element.querySelector('a[href^="mailto:"]').textContent;
    text = text.replace(/.*?([\w._%+-]+@[\w.-]+\.[A-Z]{2,}).*/i, '$1');
  }

  // Handle nested structures
  if (this.getDepth(element) > 3) {
    // Deep nesting - extract only leaf text
    text = this.getLeafText(element);
  }

  return text;
}
```

### Phase 2.4: Edge Cases and Fallbacks

#### Handle Complex Structures

1. **Nested Tables**: Flatten to single-level or preserve based on complexity
2. **Mixed Content**: Inline elements within blocks
3. **Forms**: Extract labels and values
4. **Media**: Keep alt text, ignore decorative images
5. **Scripts/Styles**: Already removed in Stage 1

#### Fallback Strategy

```javascript
defaultConverter(element) {
  // If pattern is unrecognized
  const text = this.extractText(element);

  // Apply heuristics
  if (text.length < 20 && this.looksLikeHeading(element)) {
    return `## ${text}`;
  }

  if (text.includes(':') && text.length < 100) {
    return text; // Likely key-value
  }

  // Default: return as paragraph
  return text ? `${text}\n` : '';
}
```

## Testing Strategy

### Test Cases by Website Type

1. **E-commerce Sites**
   - Product pages with specifications
   - Shopping carts with tables
   - Review sections with repeated structures

2. **News/Article Sites**
   - Article with headings and paragraphs
   - Comment sections
   - Sidebar content

3. **Business/Data Sites**
   - Company information pages
   - Financial tables
   - Contact information

4. **Documentation Sites**
   - Code examples
   - API references
   - Nested navigation

5. **Social Media**
   - Posts with mixed media
   - Profile pages
   - Comment threads

### Performance Metrics

- **Token Reduction Rate**: Target 85-90% from original
- **Content Preservation**: 100% of meaningful text
- **Structure Preservation**: Maintain logical hierarchy
- **Processing Speed**: <100ms for average page
- **Memory Usage**: <10MB for processing

## Implementation Phases

### Phase 1: Core Converter (Week 1)

- [ ] Implement pattern detection engine
- [ ] Build basic converters for each pattern type
- [ ] Create text extraction utilities
- [ ] Add fallback handling

### Phase 2: Optimization (Week 2)

- [ ] Optimize for common patterns
- [ ] Add context-aware conversion
- [ ] Implement smart heading inference
- [ ] Handle edge cases

### Phase 3: Testing & Refinement (Week 3)

- [ ] Test on 50+ different websites
- [ ] Measure token reduction rates
- [ ] Fine-tune pattern detection
- [ ] Add configuration options

### Phase 4: Integration (Week 4)

- [ ] Integrate with existing raw mode
- [ ] Add toggle option in UI
- [ ] Performance optimization
- [ ] Documentation

## Configuration Options

```typescript
interface ConversionOptions {
  // Format options
  outputFormat: 'markdown' | 'simplified-markdown' | 'key-value';

  // Table handling
  preserveComplexTables: boolean;
  maxTableColumns: number;
  convertTwoColTablesToKV: boolean;

  // Structure options
  inferHeadings: boolean;
  maxHeadingLevel: number;
  flattenDepth: number;

  // Content options
  preserveLinks: boolean;
  preserveImages: boolean;
  maxContentLength: number;

  // Performance options
  timeoutMs: number;
  maxMemoryMB: number;
}
```

## Success Criteria

1. **Universal Compatibility**: Works on 95%+ of websites
2. **Token Efficiency**: 85-90% reduction from original HTML
3. **Content Fidelity**: No loss of meaningful information
4. **Performance**: <100ms processing time
5. **Maintainability**: Clean, documented, testable code

## Risk Mitigation

### Potential Issues & Solutions

1. **Over-aggressive conversion**
   - Solution: Conservative defaults with opt-in aggressive mode
2. **Loss of important structure**
   - Solution: Preserve tables and lists by default
3. **Language-specific issues**
   - Solution: Unicode-aware text processing
4. **Performance degradation**
   - Solution: Streaming processing for large documents
5. **Edge case failures**
   - Solution: Robust fallback to simpler extraction

## Future Enhancements

1. **Machine Learning Pattern Detection**
   - Train model on common HTML patterns
   - Improve heading and structure inference

2. **Domain-Specific Templates**
   - E-commerce product template
   - News article template
   - Documentation template

3. **Reversible Conversion**
   - Store metadata for reconstruction
   - Useful for editing scenarios

4. **Streaming Processing**
   - Process large documents in chunks
   - Reduce memory usage

## Conclusion

This two-stage approach (HTML Stripping � Markdown Conversion) provides:

- **Maximum token reduction** (85-90%)
- **Universal compatibility** (works on any website)
- **Preserved semantics** (maintains meaning and structure)
- **LLM-optimized output** (clean, hierarchical markdown)

The key innovation is **pattern-based conversion** that doesn't rely on specific class names or IDs, making it work across the entire web while achieving exceptional token efficiency.
