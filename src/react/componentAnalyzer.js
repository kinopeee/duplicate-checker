const t = require('@babel/types');

class ReactComponentAnalyzer {
  constructor(options = {}) {
    this.options = {
      propsSimilarityThreshold: 0.8,
      jsxSimilarityThreshold: 0.8,
      styleSimilarityThreshold: 0.8,
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
      jsx: this.extractJSX(node),
      styles: this.extractStyles(node),
      hooks: this.extractHooks(node),
      methods: this.extractMethods(node)
    };
  }

  extractProps(node) {
    // Extract component props
    const props = [];
    if (t.isFunction(node)) {
      const params = node.params;
      if (params.length > 0 && t.isObjectPattern(params[0])) {
        props.push(...params[0].properties.map(prop => ({
          name: prop.key.name,
          required: !prop.value.optional,
          defaultValue: prop.value.right ? prop.value.right.value : undefined
        })));
      }
    }
    return props;
  }

  extractJSX(node) {
    // Extract JSX structure
    let jsx = null;
    if (t.isFunction(node)) {
      // Find return statement with JSX
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
    if (!node) return null;
    return {
      type: node.openingElement.name.name,
      props: node.openingElement.attributes.map(attr => ({
        name: attr.name.name,
        value: attr.value ? attr.value.value : null
      })),
      children: node.children
        .filter(child => t.isJSXElement(child) || t.isJSXText(child))
        .map(child => this.buildJSXTree(child))
    };
  }

  extractStyles(node) {
    // Extract style objects
    const styles = [];
    if (t.isFunction(node)) {
      const body = node.body;
      if (t.isBlockStatement(body)) {
        body.body.forEach(stmt => {
          if (t.isVariableDeclaration(stmt)) {
            stmt.declarations.forEach(decl => {
              if (decl.id.name.toLowerCase().includes('style') && t.isObjectExpression(decl.init)) {
                styles.push(this.extractStyleObject(decl.init));
              }
            });
          }
        });
      }
    }
    return styles;
  }

  extractStyleObject(node) {
    const style = {};
    node.properties.forEach(prop => {
      if (t.isObjectProperty(prop)) {
        style[prop.key.name] = prop.value.value;
      }
    });
    return style;
  }

  extractHooks(node) {
    // Extract React hooks usage
    const hooks = [];
    if (t.isFunction(node)) {
      const body = node.body;
      if (t.isBlockStatement(body)) {
        body.body.forEach(stmt => {
          if (t.isVariableDeclaration(stmt)) {
            stmt.declarations.forEach(decl => {
              if (t.isCallExpression(decl.init) && 
                  t.isIdentifier(decl.init.callee) && 
                  decl.init.callee.name.startsWith('use')) {
                hooks.push({
                  name: decl.init.callee.name,
                  dependencies: decl.init.arguments.map(arg => this.serializeNode(arg))
                });
              }
            });
          }
        });
      }
    }
    return hooks;
  }

  extractMethods(node) {
    // Extract component methods
    const methods = [];
    if (t.isFunction(node)) {
      const body = node.body;
      if (t.isBlockStatement(body)) {
        body.body.forEach(stmt => {
          if (t.isFunctionDeclaration(stmt) || 
              (t.isVariableDeclaration(stmt) && t.isArrowFunctionExpression(stmt.declarations[0].init))) {
            methods.push({
              name: stmt.id ? stmt.id.name : stmt.declarations[0].id.name,
              params: (stmt.params || stmt.declarations[0].init.params).map(param => this.serializeNode(param)),
              body: this.serializeNode(stmt.body || stmt.declarations[0].init.body)
            });
          }
        });
      }
    }
    return methods;
  }

  serializeNode(node) {
    // Helper to convert AST nodes to comparable objects
    if (!node) return null;
    if (t.isIdentifier(node)) return node.name;
    if (t.isLiteral(node)) return node.value;
    if (t.isArrayExpression(node)) return node.elements.map(el => this.serializeNode(el));
    if (t.isObjectExpression(node)) {
      const obj = {};
      node.properties.forEach(prop => {
        obj[prop.key.name] = this.serializeNode(prop.value);
      });
      return obj;
    }
    return null;
  }
}

module.exports = ReactComponentAnalyzer;
