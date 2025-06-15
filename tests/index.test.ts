import * as Y from 'yjs';
import { getYjsEventsHandler, applyJsonDiffToYjs, lcs, applyTextDelta } from '../src/main';
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
    eventsHandler = getYjsEventsHandler(plainObject, (updatedObject) => { plainObject = updatedObject as JSONObject; });
    yMap.observeDeep(eventsHandler);
  });

  test('Primitive values synchronization', () => {
    // Initialize primitive values
    ydoc.transact(() => {
      yMap.set('number', 42);
      yMap.set('boolean', true);
      yMap.set('string', new Y.Text('Hello '));
    });

    expect(plainObject).toEqual({
      number: 42,
      boolean: true,
      string: 'Hello ',
    });

    // Update primitive values
    ydoc.transact(() => {
      yMap.set('number', 100);
      yMap.set('boolean', false);
      (yMap.get('string') as Y.Text).insert(6, 'World');
    });

    expect(plainObject).toEqual({
      number: 100,
      boolean: false,
      string: 'Hello World',
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

    // Apply delta to Yjs document
    ydoc.transact(() => {
      applyJsonDiffToYjs(plainObject, newPlainObject, yMap);
    });

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

  test('Applying text deltas to Yjs documents - conflicting changes', () => {
    // Initialize data
    ydoc.transact(() => {
      yMap.set('text', new Y.Text('Hello, world!'));
    });

    expect(plainObject).toEqual({
      text: 'Hello, world!',
    });

    const oldPlainObject = { ...plainObject };

    const newPlainObject_1 = {
      text: 'Hello, vyvs!'
    };

    const newPlainObject_2 = {
      text: 'Hi, world!'
    };

    // Apply delta to Yjs document
    applyJsonDiffToYjs(oldPlainObject, newPlainObject_1, yMap);
    applyJsonDiffToYjs(oldPlainObject, newPlainObject_2, yMap);

    // Verify Yjs document
    expect((yMap.get('text') as Y.Text).toJSON()).toBe('Hi, vyvs!');
  });

  test('Applying text deltas to Yjs documents - append text', () => {
    // Initialize data
    ydoc.transact(() => {
      yMap.set('text', new Y.Text('Hello, world!'));
    });

    expect(plainObject).toEqual({
      text: 'Hello, world!',
    });

    const newPlainObject = {
      text: 'Hello, world! Hey, vyvs.'
    };

    // Apply delta to Yjs document
    applyJsonDiffToYjs(plainObject, newPlainObject, yMap);

    // Verify Yjs document
    expect((yMap.get('text') as Y.Text).toJSON()).toBe('Hello, world! Hey, vyvs.');
  });

  test('Applying text deltas to Yjs documents - erase ending text', () => {
    // Initialize data
    ydoc.transact(() => {
      yMap.set('text', new Y.Text('Hello, world!'));
    });

    expect(plainObject).toEqual({
      text: 'Hello, world!',
    });

    const newPlainObject = {
      text: 'Hello'
    };

    // Apply delta to Yjs document
    applyJsonDiffToYjs(plainObject, newPlainObject, yMap);

    // Verify Yjs document
    expect((yMap.get('text') as Y.Text).toJSON()).toBe('Hello');
  });

  test('Applying text deltas to Yjs documents - erase starting text', () => {
    // Initialize data
    ydoc.transact(() => {
      yMap.set('text', new Y.Text('Hello, world!'));
    });

    expect(plainObject).toEqual({
      text: 'Hello, world!',
    });

    const newPlainObject = {
      text: 'world!'
    };

    // Apply delta to Yjs document
    applyJsonDiffToYjs(plainObject, newPlainObject, yMap);

    // Verify Yjs document
    expect((yMap.get('text') as Y.Text).toJSON()).toBe('world!');
  });

  test('Applying text deltas to Yjs documents - prepend text', () => {
    // Initialize data
    ydoc.transact(() => {
      yMap.set('text', new Y.Text('Hello, world!'));
    });

    expect(plainObject).toEqual({
      text: 'Hello, world!',
    });

    const newPlainObject = {
      text: 'Hi, vyjs. Hello, world!'
    };

    // Apply delta to Yjs document
    applyJsonDiffToYjs(plainObject, newPlainObject, yMap);

    // Verify Yjs document
    expect((yMap.get('text') as Y.Text).toJSON()).toBe('Hi, vyjs. Hello, world!');
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

  test('Test applyTextDelta', () => {
    const oldValue = "Hello, amazing world!";
    const newValue = "Hi, gello world!";

    const doc = new Y.Doc();
    const yText = doc.getText('text');
    yText.insert(0, oldValue);

    applyTextDelta(oldValue, newValue, yText);

    expect(yText.toString()).toEqual(newValue);
  });

  test('Test LCS with String Input', () => {
    const left = "Hello, amazing world!";
    const right = "Hi, gello world!";

    const { leftIndexes, rightIndexes } = lcs(left, right);

    expect(leftIndexes).toEqual([0, 1, 2, 3, 4, 14, 15, 16, 17, 18, 19, 20]);
    expect(rightIndexes).toEqual([0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(leftIndexes.map(i => left[i]).join('')).toEqual("Hello world!");
  });

  test('Test LCS with Object Array Input', () => {
    const left = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }];
    const right = [{ id: -1 }, left[0], { id: 1 }, left[2], left[3], { id: 4 }, { id: 5 }, left[6], { id: 7 }];

    const { leftIndexes, rightIndexes } = lcs(left, right);

    expect(leftIndexes).toEqual([0, 2, 3, 6]);
    expect(rightIndexes).toEqual([1, 3, 4, 7]);
  });

  test('Null value synchronization', () => {
    ydoc.transact(() => {
      yMap.set('maybe', null);
    });

    expect(plainObject).toEqual({
      maybe: null,
    });

    const newPlainObject = {
      maybe: 1,
    };

    ydoc.transact(() => {
      applyJsonDiffToYjs(plainObject, newPlainObject, yMap);
    });

    expect(yMap.get('maybe')).toBe(1);
    expect(plainObject).toEqual({
      maybe: 1,
    });
  });

});
