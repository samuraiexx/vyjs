import * as Y from 'yjs';

export type Path = Array<string | number>;

export type JSONPrimitive = number | boolean | undefined;
export type JSONStructure = JSONObject | JSONArray | string;
export type JSONValue = JSONPrimitive | JSONStructure;
export interface JSONObject {
  [key: string]: JSONValue;
}
export type JSONArray = Array<JSONValue>

export type JsonToYType<T> = T extends Array<infer Value>
  ? Y.Array<JsonToYType<Value>>
  : T extends { [key: string]: infer MapValue }
  ? Y.Map<JsonToYType<MapValue>>
  : Y.Text;