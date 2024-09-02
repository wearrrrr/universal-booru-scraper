import { convertXML } from "simple-xml-to-json";

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


