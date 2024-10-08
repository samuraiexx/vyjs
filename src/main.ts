import * as Y from 'yjs';

import { Map as YMap, Text as YText, Array as YArray, AbstractType, YEvent } from 'yjs';
import { Delta, ObjectDelta, ArrayDelta, TextDiffDelta } from 'jsondiffpatch';
import { Path, JSONValue, JSONObject } from './types';

export function getYjsEventsHandler(plainObject: JSONObject) {
  return (events: YEvent<Y.AbstractType<unknown>>[]) => {
    events.forEach(event => {
      const path = event.path;
      const value = serializeYType(event.target);

      // Build the path in the plain object
      let current = plainObject;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (current[key] === undefined) {
          current[key] = {};
        }
        current = current[key] as JSONObject;
      }

      const key = path[path.length - 1];
      if (key !== undefined) {
        current[key] = value;
      } else {
        Object.assign(plainObject, value);
      }
    });
  };
}

export function applyJsonDiffPatchDelta(
  yType: YMap<unknown> | YArray<unknown> | YText,
  delta: Delta
): void {
  if (yType instanceof YMap) {
    applyMapDelta(yType, delta as ObjectDelta);
  } else if (yType instanceof YArray) {
    applyArrayDelta(yType, delta as ArrayDelta);
  } else if (yType instanceof YText) {
    applyTextDelta(yType, delta as TextDiffDelta);
  } else {
    throw new Error('Unsupported Yjs type');
  }
}

function serializeYType(yType: Y.AbstractType<unknown>): JSONValue {
  if (yType instanceof Y.Map) {
    const obj: JSONValue = {};
    yType.forEach((value: Y.AbstractType<unknown>, key: string) => {
      obj[key] = serializeYType(value);
    });
    return obj;
  } else if (yType instanceof Y.Array) {
    return yType.toArray().map((item: Y.AbstractType<unknown>) => serializeYType(item));
  } else if (yType instanceof Y.Text) {
    return yType.toString();
  } else {
    return yType as unknown as JSONValue;
  }
}

function applyMapDelta(yMap: YMap<unknown>, delta: ObjectDelta): void {
  for (const key in delta) {
    const change = delta[key];

    if (Array.isArray(change)) {
      if (change.length === 1) {
        // Addition
        const newValue = change[0];
        if (typeof newValue === 'string') {
          const yText = new YText();
          yText.insert(0, newValue);
          yMap.set(key, yText);
        } else {
          yMap.set(key, newValue);
        }
      } else if (change.length === 2) {
        // Modification
        const newValue = change[1];
        const oldValue = yMap.get(key);

        if (oldValue instanceof YText && typeof newValue === 'string') {
          // Update Y.Text content
          updateYText(oldValue, newValue);
        } else {
          yMap.set(key, newValue);
        }
      } else if (change.length === 3 && change[2] === 0) {
        // Deletion
        yMap.delete(key);
      }
    } else if (typeof change === 'object' && change !== null) {
      // Nested object
      let childYType = yMap.get(key) as YMap<unknown> | YArray<unknown> | YText | undefined;

      if (childYType == null) {
        // Determine the Yjs type based on the delta
        if (isArrayDelta(change)) {
          childYType = new YArray();
        } else if (isTextDelta(change)) {
          childYType = new YText();
        } else {
          childYType = new YMap();
        }
        yMap.set(key, childYType);
      }

      applyJsonDiffPatchDelta(childYType, change);
    } else {
      console.warn(`Unknown change type at key: ${key}`, change);
    }
  }
}

function applyArrayDelta(yArray: YArray<unknown>, delta: ArrayDelta): void {
  if (delta['_t'] !== 'a') {
    throw new Error('Invalid array delta');
  }

  const indexChanges = Object.keys(delta).filter(key => key !== '_t');

  indexChanges.forEach(indexKey => {
    const change = delta[indexKey as unknown as number];
    const index = parseInt(indexKey.replace('_', ''), 10);

    if (Array.isArray(change)) {
      if (change[2] === 0) {
        // Deletion
        yArray.delete(index, 1);
      } else if (change.length === 1) {
        // Addition
        yArray.insert(index, [change[0]]);
      } else if (change.length === 2) {
        // Modification
        yArray.delete(index, 1);
        yArray.insert(index, [change[1]]);
      }
    } else if (typeof change === 'object' && change !== null) {
      // Nested changes within an array element
      const element = yArray.get(index) as AbstractType<unknown>;
      if (element instanceof YMap || element instanceof YArray || element instanceof YText) {
        applyJsonDiffPatchDelta(element, change);
      } else {
        console.warn(`Unsupported Yjs type in array at index: ${index}`);
      }
    } else {
      console.warn(`Unknown change type at array index: ${index}`, change);
    }
  });
}

function applyTextDelta(yText: YText, delta: TextDiffDelta): void {
  if (Array.isArray(delta)) {
    if (delta.keys.length === 1) {
      // Addition or replacement
      yText.delete(0, yText.length);
      yText.insert(0, delta[0] as string);
    } else if (delta.keys.length === 2) {
      // Modification
      const newValue = delta[1] as unknown as string;
      updateYText(yText, newValue);
    } else {
      console.warn('Unsupported text delta format', delta);
    }
  } else {
    console.warn('Invalid delta format for Y.Text', delta);
  }
}

function updateYText(yText: YText, newValue: string): void {
  // Simple implementation: replace entire content
  yText.delete(0, yText.length);
  yText.insert(0, newValue);
}

function isArrayDelta(delta: Delta): delta is Delta {
  return (
    typeof delta === 'object' &&
    delta !== null &&
    '_t' in delta &&
    (delta as ArrayDelta)['_t'] === 'a'
  );
}

function isTextDelta(delta: Delta): boolean {
  // A heuristic to determine if the delta is for Y.Text
  return Array.isArray(delta) && delta.every(item => typeof item === 'string');
}

function processYjsEvent(
  event: Y.YEvent<Y.AbstractType<unknown>>,
  delta: Delta,
  path: Path
): void {
  if (event instanceof Y.YMapEvent) {
    handleMapEvent(event, delta, path);
  } else if (event instanceof Y.YArrayEvent) {
    handleArrayEvent(event, delta, path);
  } else if (event instanceof Y.YTextEvent) {
    handleTextEvent(event, delta, path);
  }
}

function handleMapEvent(
  event: Y.YMapEvent<unknown>,
  delta: Delta,
  path: Path
): void {
  const { keysChanged, target } = event;

  keysChanged.forEach(key => {
    const keyChange = event.changes.keys.get(key);
    const currentPath = [...path, key];

    if (keyChange) {
      if (keyChange.action === 'add') {
        const newValue = target.get(key);
        const jsonValue = yjsValueToJSON(newValue);
        setDeltaValue(delta, currentPath, [jsonValue]);
      } else if (keyChange.action === 'update') {
        const oldValue = keyChange.oldValue;
        const newValue = target.get(key);

        // Check if the newValue is a Yjs type
        if (newValue instanceof Y.AbstractType) {
          // Process nested events recursively
          const nestedEvent = new Y.YEvent(newValue, event.transaction);
          processYjsEvent(nestedEvent, delta, currentPath);
        } else {
          const oldJsonValue = yjsValueToJSON(oldValue);
          const newJsonValue = yjsValueToJSON(newValue);
          setDeltaValue(delta, currentPath, [oldJsonValue, newJsonValue]);
        }
      } else if (keyChange.action === 'delete') {
        const oldValue = keyChange.oldValue;
        const oldJsonValue = yjsValueToJSON(oldValue);
        setDeltaValue(delta, currentPath, [oldJsonValue, 0, 0]);
      }
    }
  });
}

function handleArrayEvent(
  event: Y.YArrayEvent<unknown>,
  delta: Delta,
  path: Path
): void {
  // const { target } = event;
  const arrayDelta: Delta = { _t: 'a' };
  const currentPath = [...path];

  let index = 0;

  event.changes.delta.forEach(change => {
    if (change.insert !== undefined) {
      // Handle insertions
      (change.insert as unknown[]).forEach((value, i: number) => {
        const idx = index + i;
        const jsonValue = yjsValueToJSON(value);
        arrayDelta[idx] = [jsonValue];
      });
      index += change.insert.length;
    } else if (change.delete !== undefined) {
      // Handle deletions
      for (let i = 0; i < change.delete; i++) {
        const idx = index;
        arrayDelta[`_${idx}`] = [0, 0, 0];
        index++;
      }
    } else if (change.retain !== undefined) {
      // Retain indicates no change
      index += change.retain;
    } else {
      console.warn('Unknown array change', change);
    }
  });

  // Set the array delta in the overall delta object
  setDeltaValue(delta, currentPath, arrayDelta);
}

function handleTextEvent(
  event: Y.YTextEvent,
  delta: Delta,
  path: Path
): void {
  const { target } = event;
  const currentPath = [...path];
  // const oldValue = event._preSnapshot.getText(target).toString();
  const oldValue = "";
  const newValue = target.toString();

  setDeltaValue(delta, currentPath, [oldValue, newValue]);
}

function setDeltaValue(
  delta: Delta,
  path: Path,
  value: Delta
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = delta;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (typeof key === 'number') {
      if (!current['_t']) {
        current['_t'] = 'a';
      }
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    } else {
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
  }
  const lastKey = path[path.length - 1];
  if (typeof lastKey === 'number') {
    if (!current['_t']) {
      current['_t'] = 'a';
    }
    current[lastKey] = value;
  } else {
    current[lastKey] = value;
  }
}

function yjsValueToJSON(value: unknown): JSONValue {
  if (value instanceof Y.Text) {
    return value.toString();
  } else if (value instanceof Y.AbstractType) {
    return value.toJSON() as JSONValue;
  } else {
    return value as JSONValue;
  }
}
