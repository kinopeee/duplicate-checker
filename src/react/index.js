import { ReactComponentAnalyzer } from './componentAnalyzer.js';
import { ReactComponentComparator } from './componentComparator.js';
import { ReactHooksAnalyzer } from './hooks/hooksAnalyzer.js';
import { ReactHooksComparator } from './hooks/hooksComparator.js';

export class ReactDuplicateDetector {
  constructor(options = {}) {
    this.analyzer = new ReactComponentAnalyzer(options);
    this.comparator = new ReactComponentComparator(options);
    this.hooksAnalyzer = new ReactHooksAnalyzer(options);
    this.hooksComparator = new ReactHooksComparator(options);
  }

  async detectDuplicates(components) {
    const analyzedComponents = await Promise.all(
      components.map(async ({ node, file }) => ({
        file,
        component: await this.analyzer.analyzeComponent(node, file),
        hooks: this.hooksAnalyzer.analyzeHooks(node)
      }))
    );

    const duplicates = [];
    for (let i = 0; i < analyzedComponents.length; i++) {
      for (let j = i + 1; j < analyzedComponents.length; j++) {
        const comp1 = analyzedComponents[i];
        const comp2 = analyzedComponents[j];

        if (comp1.component && comp2.component) {
          const componentSimilarity = this.comparator.compareComponents(
            comp1.component,
            comp2.component
          );

          const hooksSimilarity = this.hooksComparator.compareHooks(
            comp1.hooks,
            comp2.hooks
          );

          // Weight component structure more heavily than hooks
          const similarity = (componentSimilarity * 0.7) + (hooksSimilarity * 0.3);

          if (similarity >= 0.8) {
            duplicates.push({
              similarity,
              files: [comp1.file, comp2.file],
              details: {
                props: this.comparator.compareProps(comp1.component.props, comp2.component.props),
                jsx: this.comparator.compareJSX(comp1.component.jsx, comp2.component.jsx),
                hooks: hooksSimilarity
              }
            });
          }
        }
      }
    }

    return duplicates;
  }
}
