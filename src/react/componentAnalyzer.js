import * as t from '@babel/types';

export class ReactComponentAnalyzer {
  constructor(options = {}) {
    this.options = {
      propsSimilarityThreshold: 0.8,
      jsxSimilarityThreshold: 0.8,
      ...options
    };
  }

  async analyzeComponent(node, file) {
    if (t.isVariableDeclaration(node) || t.isFunctionDeclaration(node)) {
      const component = this.extractComponent(node);
      if (component) {
        return component;
      }
    }
    return null;
  }

  extractComponent(node) {
    return {
      props: this.extractProps(node),
      jsx: this.extractJSX(node)
    };
  }

  extractProps(node) {
    const props = [];
    if (t.isFunction(node)) {
      const params = node.params;
      if (params.length > 0 && t.isObjectPattern(params[0])) {
        props.push(...params[0].properties.map(prop => {
          const hasDefault = t.isAssignmentPattern(prop.value);
          return {
            name: prop.key.name,
            required: !hasDefault,
            defaultValue: hasDefault ? prop.value.right.value : undefined
          };
        }));
      }
    }
    return props;
  }

  extractJSX(node) {
    let jsx = null;
    if (t.isFunction(node)) {
      const body = node.body;
      if (t.isBlockStatement(body)) {
        const returnStmt = body.body.find(stmt => t.isReturnStatement(stmt));
        if (returnStmt && t.isJSXElement(returnStmt.argument)) {
          jsx = this.buildJSXTree(returnStmt.argument);
        }
      } else if (t.isJSXElement(body)) {
        jsx = this.buildJSXTree(body);
      }
    }
    return jsx;
  }

  buildJSXTree(node) {
    if (!node || !t.isJSXElement(node)) return null;
    return {
      type: node.openingElement.name.name,
      props: node.openingElement.attributes.map(attr => ({
        name: attr.name.name,
        value: attr.value && t.isStringLiteral(attr.value) ? attr.value.value : null
      })),
      children: node.children
        .filter(child => t.isJSXElement(child))
        .map(child => this.buildJSXTree(child))
        .filter(Boolean)
    };
  }
}
