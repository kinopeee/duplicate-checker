import * as t from '@babel/types';

export class ReactStyleAnalyzer {
  constructor(options = {}) {
    this.options = {
      inlineStyleWeight: 0.4,
      classNameWeight: 0.4,
      styledComponentWeight: 0.2,
      ...options
    };
  }

  analyzeStyles(node) {
    if (!node) return null;

    return {
      inlineStyles: this.extractInlineStyles(node),
      classNames: this.extractClassNames(node),
      styledComponents: this.extractStyledComponents(node)
    };
  }

  extractInlineStyles(node) {
    const styles = [];
    if (t.isJSXElement(node)) {
      const styleAttr = node.openingElement.attributes.find(
        attr => t.isJSXAttribute(attr) && attr.name.name === 'style'
      );
      
      if (styleAttr && t.isJSXExpressionContainer(styleAttr.value)) {
        if (t.isObjectExpression(styleAttr.value.expression)) {
          styles.push(this.parseStyleObject(styleAttr.value.expression));
        }
      }
    }
    return styles;
  }

  extractClassNames(node) {
    const classNames = new Set();
    if (t.isJSXElement(node)) {
      const classAttr = node.openingElement.attributes.find(
        attr => t.isJSXAttribute(attr) && (attr.name.name === 'className' || attr.name.name === 'class')
      );
      
      if (classAttr) {
        if (t.isStringLiteral(classAttr.value)) {
          classAttr.value.value.split(/\s+/).forEach(cls => classNames.add(cls));
        } else if (t.isJSXExpressionContainer(classAttr.value)) {
          if (t.isStringLiteral(classAttr.value.expression)) {
            classAttr.value.expression.value.split(/\s+/).forEach(cls => classNames.add(cls));
          }
        }
      }
    }
    return Array.from(classNames);
  }

  extractStyledComponents(node) {
    const styledComponents = [];
    if (t.isVariableDeclaration(node)) {
      node.declarations.forEach(decl => {
        if (t.isCallExpression(decl.init) && 
            t.isMemberExpression(decl.init.callee) &&
            decl.init.callee.object.name === 'styled') {
          styledComponents.push({
            name: decl.id.name,
            baseComponent: decl.init.callee.property.name,
            styles: this.extractStyledComponentStyles(decl.init.arguments)
          });
        }
      });
    }
    return styledComponents;
  }

  parseStyleObject(objExpr) {
    const styles = {};
    objExpr.properties.forEach(prop => {
      if (t.isObjectProperty(prop)) {
        const key = prop.key.name;
        if (t.isStringLiteral(prop.value)) {
          styles[key] = prop.value.value;
        } else if (t.isNumericLiteral(prop.value)) {
          styles[key] = prop.value.value;
        }
      }
    });
    return styles;
  }

  extractStyledComponentStyles(args) {
    if (args.length === 0) return [];
    
    const styles = [];
    args.forEach(arg => {
      if (t.isTemplateLiteral(arg)) {
        styles.push(arg.quasis.map(quasi => quasi.value.raw).join(''));
      }
    });
    return styles;
  }
}
