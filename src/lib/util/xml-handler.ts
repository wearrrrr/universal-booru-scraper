import pkg from "simple-xml-to-json";

const { convertXML } = pkg;

export function parseXML(xml: string) {
  try {
    return convertXML(xml);
  } catch {
    return null;
  }
}

export function checkXML(xml: string): boolean {
  try {
    convertXML(xml);
    return true;
  } catch {
    return false;
  }
}

/**
 * @description Converts XML data to JSON data. Data needs to be parsed with simple-xml-to-json first.
 * @param xml XML data to be converted.
 * @returns JSON data from the XML.
 */
export function convertXMLDataToJSON(xml: XMLNode): any {
  const result: { [key: string]: any[] } = {};

  for (const key in xml) {
    if (xml.hasOwnProperty(key)) {
      const children = hasChildren(xml[key]) ? xml[key].children : undefined;
      if (children && Array.isArray(children)) {
        // Array values
        result[key] = extractAndFlatten(children);
      } else {
        // Non array values
        result[key] = extractAndFlatten(xml[key]);
      }
    }
  }

  return result;
}

function hasChildren(node: any): node is { children: any[] } {
  return typeof node === 'object' && node !== null && 'children' in node;
}

function extractAndFlatten(node: any): any {
  if (typeof node !== 'object') return node;

  if (Array.isArray(node)) {
    return node.map(child => extractAndFlatten(child));
  } else {
    const flat: Record<string, any> = {};
    for (const key in node) {
      if (node.hasOwnProperty(key)) {
        const value = node[key];
        if (typeof value === 'object') {
          Object.assign(flat, extractAndFlatten(value));
        } else {
          flat[key] = value;
        }
      }
    }
    return flat;
  }
}