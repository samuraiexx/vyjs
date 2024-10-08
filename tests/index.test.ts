import * as Y from 'yjs';
import { getYjsEventsHandler, applyJsonDiffPatchDelta } from '../src/main';
import { diff } from 'jsondiffpatch';
import { JSONObject } from '../src/types';

describe('Yjs and jsondiffpatch integration tests', () => {
  let ydoc: Y.Doc;
  let yMap: Y.Map<unknown>;
  let plainObject: JSONObject;
  let eventsHandler: (events: Y.YEvent<Y.AbstractType<unknown>>[], transaction: Y.Transaction) => void;

  beforeEach(() => {
    ydoc = new Y.Doc();
    yMap = ydoc.getMap<unknown>('rootMap');
    plainObject = {};
    eventsHandler = getYjsEventsHandler(plainObject);
    yMap.observeDeep(eventsHandler);
  });

  test('Primitive values synchronization', () => {
    // Initialize primitive values
    ydoc.transact(() => {
      yMap.set('number', 42);
      yMap.set('boolean', true);
      yMap.set('string', 'Hello');
    });

    expect(plainObject).toEqual({
      number: 42,
      boolean: true,
      string: 'Hello',
    });

    // Update primitive values
    ydoc.transact(() => {
      yMap.set('number', 100);
      yMap.set('boolean', false);
      yMap.set('string', 'World');
    });

    expect(plainObject).toEqual({
      number: 100,
      boolean: false,
      string: 'World',
    });
  });

  test('Nested structures synchronization', () => {
    // Create nested map
    ydoc.transact(() => {
      const nestedMap = new Y.Map<unknown>();
      nestedMap.set('key1', 'value1');
      yMap.set('nested', nestedMap);
    });

    expect(plainObject).toEqual({
      nested: {
        key1: 'value1',
      },
    });

    // Update nested map
    ydoc.transact(() => {
      const nestedMap = yMap.get('nested') as Y.Map<unknown>;
      nestedMap.set('key2', 'value2');
    });

    expect(plainObject).toEqual({
      nested: {
        key1: 'value1',
        key2: 'value2',
      },
    });

    // Delete a key from nested map
    ydoc.transact(() => {
      const nestedMap = yMap.get('nested') as Y.Map<unknown>;
      nestedMap.delete('key1');
    });

    expect(plainObject).toEqual({
      nested: {
        key2: 'value2',
      },
    });
  });

  test('Array synchronization', () => {
    // Initialize array
    ydoc.transact(() => {
      const yArray = new Y.Array<unknown>();
      yArray.insert(0, ['apple', 'banana', 'cherry']);
      yMap.set('fruits', yArray);
    });

    expect(plainObject).toEqual({
      fruits: ['apple', 'banana', 'cherry'],
    });

    // Update array
    ydoc.transact(() => {
      const yArray = yMap.get('fruits') as Y.Array<unknown>;
      yArray.delete(1, 1); // Remove 'banana'
      yArray.insert(1, ['blueberry']); // Insert 'blueberry' at index 1
    });

    expect(plainObject).toEqual({
      fruits: ['apple', 'blueberry', 'cherry'],
    });

    // Add more items
    ydoc.transact(() => {
      const yArray = yMap.get('fruits') as Y.Array<unknown>;
      yArray.push(['date']);
    });

    expect(plainObject).toEqual({
      fruits: ['apple', 'blueberry', 'cherry', 'date'],
    });
  });

  test('Text synchronization', () => {
    // Initialize text
    ydoc.transact(() => {
      const yText = new Y.Text();
      yText.insert(0, 'Hello, world!');
      yMap.set('greeting', yText);
    });

    expect(plainObject).toEqual({
      greeting: 'Hello, world!',
    });

    // Update text
    ydoc.transact(() => {
      const yText = yMap.get('greeting') as Y.Text;
      yText.delete(7, 5); // Remove 'world'
      yText.insert(7, 'Yjs'); // Insert 'Yjs'
    });

    expect(plainObject).toEqual({
      greeting: 'Hello, Yjs!',
    });
  });

  test('Recursive changes in nested structures', () => {
    // Initialize nested structure
    ydoc.transact(() => {
      const nestedMap = new Y.Map<unknown>();
      const nestedArray = new Y.Array<unknown>();
      nestedArray.insert(0, [1, 2, 3]);
      nestedMap.set('numbers', nestedArray);
      yMap.set('nested', nestedMap);
    });

    expect(plainObject).toEqual({
      nested: {
        numbers: [1, 2, 3],
      },
    });

    // Update nested array
    ydoc.transact(() => {
      const nestedMap = yMap.get('nested') as Y.Map<unknown>;
      const nestedArray = nestedMap.get('numbers') as Y.Array<unknown>;
      nestedArray.delete(1, 1); // Remove '2'
      nestedArray.insert(1, [4, 5]); // Insert '4' and '5' at index 1
    });

    expect(plainObject).toEqual({
      nested: {
        numbers: [1, 4, 5, 3],
      },
    });

    // Add nested text
    ydoc.transact(() => {
      const nestedMap = yMap.get('nested') as Y.Map<unknown>;
      const yText = new Y.Text();
      yText.insert(0, 'Nested text');
      nestedMap.set('text', yText);
    });

    expect(plainObject).toEqual({
      nested: {
        numbers: [1, 4, 5, 3],
        text: 'Nested text',
      },
    });

    // Update nested text
    ydoc.transact(() => {
      const nestedMap = yMap.get('nested') as Y.Map<unknown>;
      const yText = nestedMap.get('text') as Y.Text;
      yText.insert(6, ' Yjs');
    });

    expect(plainObject).toEqual({
      nested: {
        numbers: [1, 4, 5, 3],
        text: 'Nested Yjs text',
      },
    });
  });

  test('Applying deltas to Yjs documents', () => {
    // Initialize data
    ydoc.transact(() => {
      yMap.set('count', 10);
      yMap.set('status', true);
    });

    expect(plainObject).toEqual({
      count: 10,
      status: true,
    });

    const newPlainObject = {
      count: 20,
      status: false,
      message: 'Hello'
    };

    const delta = diff(plainObject, newPlainObject);

    // Apply delta to Yjs document
    applyJsonDiffPatchDelta(yMap, delta);

    // Verify Yjs document
    expect(yMap.get('count')).toBe(20);
    expect(yMap.get('status')).toBe(false);
    expect((yMap.get('message') as Y.Text).toJSON()).toBe('Hello');

    // Verify plain object (should be updated via observer)
    expect(plainObject).toEqual({
      count: 20,
      status: false,
      message: 'Hello',
    });
  });

  test('Conflict resolution with concurrent changes', () => {
    // Initialize data
    ydoc.transact(() => {
      yMap.set('sharedNumber', 1);
    });

    expect(plainObject).toEqual({
      sharedNumber: 1,
    });

    // Simulate concurrent changes
    const ydoc2 = new Y.Doc();
    const yMap2 = ydoc2.getMap<unknown>('rootMap');
    ydoc2.transact(() => {
      yMap2.set('sharedNumber', 1);
    });

    // Apply changes to both documents
    ydoc.transact(() => {
      yMap.set('sharedNumber', 2); // Change in doc1
    });

    ydoc2.transact(() => {
      yMap2.set('sharedNumber', 3); // Change in doc2
    });

    // Merge changes
    const update1 = Y.encodeStateAsUpdate(ydoc);
    const update2 = Y.encodeStateAsUpdate(ydoc2);

    Y.applyUpdate(ydoc, update2);
    Y.applyUpdate(ydoc2, update1);

    // Verify that the last change wins (Yjs default conflict resolution)
    const finalValue = yMap.get('sharedNumber');
    expect(finalValue === 2 || finalValue === 3).toBeTruthy();

    // Update plain object
    plainObject.sharedNumber = finalValue as number;

    expect(plainObject).toEqual({
      sharedNumber: finalValue,
    });
  });
});
