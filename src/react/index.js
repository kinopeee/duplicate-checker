import { ReactComponentAnalyzer } from './componentAnalyzer.js';
import { ReactComponentComparator } from './componentComparator.js';

export class ReactDuplicateDetector {
  constructor(options = {}) {
    this.analyzer = new ReactComponentAnalyzer(options);
    this.comparator = new ReactComponentComparator(options);
  }

  async detectDuplicates(components) {
    const analyzedComponents = await Promise.all(
      components.map(async ({ node, file }) => ({
        file,
        component: await this.analyzer.analyzeComponent(node, file)
      }))
    );

    const duplicates = [];
    for (let i = 0; i < analyzedComponents.length; i++) {
      for (let j = i + 1; j < analyzedComponents.length; j++) {
        const comp1 = analyzedComponents[i];
        const comp2 = analyzedComponents[j];

        if (comp1.component && comp2.component) {
          const similarity = this.comparator.compareComponents(
            comp1.component,
            comp2.component
          );

          if (similarity >= 0.8) {
            duplicates.push({
              similarity,
              files: [comp1.file, comp2.file],
              details: {
                props: this.comparator.compareProps(comp1.component.props, comp2.component.props),
                jsx: this.comparator.compareJSX(comp1.component.jsx, comp2.component.jsx)
              }
            });
          }
        }
      }
    }

    return duplicates;
  }
}
