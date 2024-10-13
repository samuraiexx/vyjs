import { Map as YMap, Text as YText, Array as YArray, YEvent, AbstractType as YAbstractType } from 'yjs';
import { JSONValue, JSONObject, JSONArray, JsonToYType, JSONPrimitive } from './types';

// Get Yjs events handler that can be passed to Yjs.observeDeep
export function getYjsEventsHandler(currentValue: JSONValue, callback: (updatedValue: JSONValue) => void) {
  return (events: YEvent<YAbstractType<unknown>>[]) => {
    const builder = (obj: JSONValue, path: (string | number)[], value: JSONValue): JSONValue => {
      if (path.length === 0 ||
        obj === undefined ||
        typeof path[0] === 'number' && !(obj instanceof Array) ||
        typeof path[0] === 'string' && !(obj instanceof Object)
      ) {
        return value;
      }

      const key = path[0];
      if (typeof key === 'number') {
        const newArray = [...(obj as JSONArray)];
        newArray[key] = builder((obj as JSONArray)[key], path.slice(1), value);
        return newArray;
      }

      if (typeof key === 'string') {
        return { ...(obj as JSONObject), [key]: builder((obj as JSONObject)[key], path.slice(1), value) };
      }
    };

    events.forEach(event => {
      const value = serializeYType(event.target);
      currentValue = builder(currentValue, event.path, value);
    });

    callback(currentValue);
  };
}

// Apply the difference between two JSON objects to a Yjs type
export function applyJsonDiffToYjs(
  oldValue: JSONValue,
  newValue: JSONValue,
  yValue: YMap<unknown> | YArray<unknown> | YText | JSONPrimitive,
  yValueParent: YMap<unknown> | YArray<unknown> | undefined = undefined,
  yValueKey: number | string | undefined = undefined
): void {
  if (oldValue === newValue) {
    return;
  }

  const oldValueType = getJsonType(oldValue);
  const newValueType = getJsonType(newValue);

  assert(
    yValue instanceof YMap && oldValueType === JsonType.Object ||
    yValue instanceof YArray && oldValueType === JsonType.Array ||
    yValue instanceof YText && oldValueType === JsonType.Text ||
    oldValueType === JsonType.primitive,
    'Old value type does not match Yjs type'
  );

  assert(
    yValueParent instanceof YMap || yValueParent instanceof YArray || yValueParent === undefined,
    "Invalid parent type"
  );

  if (oldValueType !== newValueType || newValueType === JsonType.primitive) {
    if (yValueParent instanceof YMap) {
      yValueParent.delete(yValueKey as string);
      yValueParent.set(yValueKey as string, jsonToYType(newValue));
    }

    if (yValueParent instanceof YArray) {
      yValueParent.delete(yValueKey as number, 1);
      yValueParent.insert(yValueKey as number, [jsonToYType(newValue)]);
    }

    return;
  }

  switch (newValueType) {
    case JsonType.Object:
      applyMapDelta(oldValue as JSONObject, newValue as JSONObject, yValue as YMap<unknown>);
      break;
    case JsonType.Array:
      applyArrayDelta(oldValue as JSONArray, newValue as JSONArray, yValue as YArray<unknown>);
      break;
    case JsonType.Text:
      applyTextDelta(oldValue as string, newValue as string, yValue as YText);
      break;
    default:
      throw new Error('Invalid JSON type');
  }
}


// Convert JSON object to Yjs type
export function jsonToYType<T>(object: T): JsonToYType<T> {
  if (Array.isArray(object)) {
    const yArray = new YArray();
    object.forEach((value) => yArray.push([jsonToYType(value)]));
    return yArray as JsonToYType<T>;
  } else if (typeof object === "object") {
    const map = new YMap();
    for (const key in object) {
      map.set(key, jsonToYType(object[key]));
    }
    return map as JsonToYType<T>;
  } else if (typeof object === "string") {
    return new YText(object) as JsonToYType<T>;
  } else {
    return object as unknown as JsonToYType<T>;
  }
}

enum JsonType {
  Object = 'object',
  Array = 'array',
  Text = 'text',
  primitive = 'primitive',
}

function getJsonType(value: JSONValue): JsonType {
  if (value instanceof Array) {
    return JsonType.Array;
  } else if (value instanceof Object) {
    return JsonType.Object;
  } else if (typeof value === 'string') {
    return JsonType.Text;
  } else {
    return JsonType.primitive;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function lcs<T extends string | unknown[]>(left: T, right: T): { leftIndexes: number[]; rightIndexes: number[] } {
  const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      dp[i][j] = left[i - 1] === right[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const leftIndexes: number[] = [];
  const rightIndexes: number[] = [];

  let i = left.length;
  let j = right.length;

  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      leftIndexes.push(i - 1);
      rightIndexes.push(j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return { leftIndexes: leftIndexes.reverse(), rightIndexes: rightIndexes.reverse() };
}

function serializeYType(yType: YAbstractType<unknown>): JSONValue {
  if (yType instanceof YMap || yType instanceof YArray || yType instanceof YText) {
    return yType.toJSON();
  } else {
    return yType as unknown as JSONPrimitive;
  }
}

function applyMapDelta(oldValue: JSONObject, newValue: JSONObject, yMap: YMap<unknown>): void {
  const oldValueKeys = new Set(oldValue ? Object.keys(oldValue) : []);
  const newValueKeys = new Set(newValue ? Object.keys(newValue) : []);

  const deletedKeys = [...oldValueKeys].filter(key => !newValueKeys.has(key));
  const addedKeys = [...newValueKeys].filter(key => !oldValueKeys.has(key));
  const commonKeys = [...oldValueKeys].filter(key => newValueKeys.has(key));

  // Handle deletions
  deletedKeys.forEach(key => {
    yMap.delete(key);
  });

  // Handle additions
  addedKeys.forEach(key => {
    yMap.set(key, jsonToYType(newValue![key]));
  });

  // Handle modifications
  commonKeys.forEach(key => {
    const oldValueValue = oldValue![key];
    const newValueValue = newValue![key];
    const yValue = yMap.get(key) as YMap<unknown> | YArray<unknown> | YText | undefined;

    applyJsonDiffToYjs(oldValueValue, newValueValue, yValue, yMap, key);
  });
}

function applyArrayDelta(oldValue: JSONArray, newValue: JSONArray, yArray: YArray<unknown>): void {
  const { leftIndexes: unchangedOldElementIdxs, rightIndexes: unchangedNewElementsIdxs } = lcs(oldValue, newValue);
  unchangedNewElementsIdxs.push(newValue.length);
  unchangedOldElementIdxs.push(oldValue.length);

  for (let newIdx = 0, oldIdx = 0, idxsIdx = 0; newIdx < newValue.length || oldIdx < oldValue.length;) {
    // Optimistically assume that the current elent changed
    if (newIdx < unchangedNewElementsIdxs[idxsIdx] && oldIdx < unchangedOldElementIdxs[idxsIdx]) {
      applyJsonDiffToYjs(oldValue[oldIdx], newValue[newIdx], yArray.get(newIdx) as YMap<unknown> | YArray<unknown> | YText, yArray, newIdx);
      newIdx++;
      oldIdx++;
    }

    // Added
    if (newIdx < unchangedNewElementsIdxs[idxsIdx]) {
      yArray.insert(newIdx, [jsonToYType(newValue[newIdx])]);
      newIdx++;
      continue;
    }

    // Deleted
    if (oldIdx < unchangedOldElementIdxs[idxsIdx]) {
      yArray.delete(newIdx, 1);
      oldIdx++;
      continue;
    }

    // Unchanged
    if (unchangedNewElementsIdxs[idxsIdx] === newIdx) {
      newIdx++;
      oldIdx++;
      idxsIdx++;
      continue;
    }
  }

  yArray.delete(newValue.length, oldValue.length - newValue.length);
}

export function applyTextDelta(oldValue: string, newValue: string, yText: YText): void {
  const { leftIndexes: unchangedOldElementIdxs, rightIndexes: unchangedNewElementsIdxs } = lcs(oldValue, newValue);
  unchangedNewElementsIdxs.push(newValue.length);
  unchangedOldElementIdxs.push(oldValue.length);

  for (let newIdx = 0, oldIdx = 0, idxsIdx = 0; newIdx < newValue.length || oldIdx < oldValue.length;) {
    // Added
    if (newIdx < unchangedNewElementsIdxs[idxsIdx]) {
      yText.insert(newIdx, newValue[newIdx]);
      newIdx++;
      continue;
    }

    // Deleted
    if (oldIdx < unchangedOldElementIdxs[idxsIdx]) {
      yText.delete(newIdx, 1);
      oldIdx++;
      continue;
    }

    // Unchanged
    if (unchangedNewElementsIdxs[idxsIdx] === newIdx) {
      newIdx++;
      oldIdx++;
      idxsIdx++;
      continue;
    }
  }
}
