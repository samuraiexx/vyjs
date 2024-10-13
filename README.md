# vyjs - Vanilla Yjs Integration

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/samuraiexx/vyjs)

This project provides utilities for synchronizing Yjs documents with plain objects, applying diffs/deltas, and handling nested structures, arrays, and text types. It aims to simplify the integration of Yjs with React applications by offering a straightforward and vanilla approach.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Synchronizing Yjs Documents with Plain Objects](#synchronizing-yjs-documents-with-plain-objects)
  - [Integrating with React](#integrating-with-react)
  - [Applying Differences Between JSON Objects to Yjs Types](#applying-differences-between-json-objects-to-yjs-types)
- [Running Tests](#running-tests)
- [API Reference](#api-reference)
  - [`getYjsEventsHandler(currentValue, callback)`](#getyjseventshandlercurrentvalue-callback)
  - [`applyJsonDiffToYjs(oldValue, newValue, yValue, yValueParent, yValueKey)`](#applyjsondifftoyjsoldvalue-newvalue-yvalue-yvalueparent-yvaluekey)
  - [`jsonToYType(object)`](#jsontoytypeobject)
- [Examples](#examples)
  - [Nested Structures Synchronization](#nested-structures-synchronization)
  - [Conflict Resolution with Concurrent Changes](#conflict-resolution-with-concurrent-changes)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Introduction

**vyjs** (Vanilla Yjs) is a utility library designed to simplify the integration of [Yjs](https://github.com/yjs/yjs) with React and other JavaScript frameworks. It provides a minimalistic approach to synchronize Yjs documents with plain JavaScript objects, making it easier to build real-time collaborative applications without the overhead of complex abstractions.

## Features

- **Vanilla Integration**: Offers a straightforward way to use Yjs without additional abstractions.
- **React Compatibility**: Simplifies the integration of Yjs with React applications.
- **Synchronization**: Automatically synchronize Yjs documents with plain JavaScript objects.
- **Difference Application**: Apply the difference between two JSON objects to Yjs types.
- **Nested Structures**: Support for nested maps, arrays, and text types within Yjs documents.
- **Conflict Resolution**: Handle concurrent changes with Yjs's built-in conflict resolution mechanisms.
- **Comprehensive Tests**: A suite of tests demonstrating various synchronization scenarios.

## Installation

Install **vyjs** via npm:

```bash
npm install vyjs
```

## Usage

### Synchronizing Yjs Documents with Plain Objects

Import the necessary modules:

```javascript
import * as Y from 'yjs';
import { getYjsEventsHandler } from 'vyjs';

const ydoc = new Y.Doc();
const yMap = ydoc.getMap('rootMap');
let currentValue = {};

const callback = (updatedValue) => {
  currentValue = updatedValue;
  console.log('Updated Value:', currentValue);
};

const eventsHandler = getYjsEventsHandler(currentValue, callback);
yMap.observeDeep(eventsHandler);

// Now, any changes made to yMap will be reflected in currentValue via the callback:

ydoc.transact(() => {
  yMap.set('number', 42);
  yMap.set('text', new Y.Text('Hello, Yjs!'));
});
```

### Integrating with React

**vyjs** makes it easier to integrate Yjs with React by keeping your component state in sync with Yjs documents.

```jsx
import React, { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { getYjsEventsHandler } from 'vyjs';

const ydoc = new Y.Doc();
const yMap = ydoc.getMap('rootMap');

function App() {
  const [state, setState] = useState({});

  useEffect(() => {
    let currentValue = {};

    const callback = (updatedValue) => {
      setState(updatedValue);
    };

    const eventsHandler = getYjsEventsHandler(currentValue, callback);

    yMap.observeDeep(eventsHandler);

    return () => {
      yMap.unobserveDeep(eventsHandler);
    };
  }, []);

  return (
    <div>
      <h1>Yjs and React Integration</h1>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
}

export default App;
```

With this setup, any changes to the Yjs document will automatically update the React component's state, ensuring seamless synchronization between the collaborative data and your UI.

### Applying Differences Between JSON Objects to Yjs Types

Import the `applyJsonDiffToYjs` function:

```javascript
import { applyJsonDiffToYjs } from 'vyjs';
import * as Y from 'yjs';

const ydoc = new Y.Doc();
const yMap = ydoc.getMap('map');

const oldValue = {
  number: 42,
  text: 'Hello, Yjs!',
};

const newValue = {
  number: 100,
  text: 'Hi',
  status: true,
};

// Initialize yMap with oldValue
Object.keys(oldValue).forEach((key) => {
  yMap.set(key, oldValue[key]);
});

// Apply the difference between oldValue and newValue to yMap
applyJsonDiffToYjs(oldValue, newValue, yMap);

console.log(yMap.get('number')); // Output: 100
console.log(yMap.get('status')); // Output: true
console.log(yMap.get('text').toString()); // Output: 'Hi'
```

## Running Tests

```bash
npm test
```

## API Reference

### `getYjsEventsHandler(currentValue, callback)`

Returns an event handler function that synchronizes changes from a Yjs document to a plain JavaScript object.

- **Parameters:**
  - `currentValue` (_Object_): The current value of the plain JavaScript object.
  - `callback` (_Function_): The function to call with the updated value.
- **Returns:**
  - _(Function)_: An event handler to be used with `yMap.observeDeep()`.

**Usage:**

```javascript
const eventsHandler = getYjsEventsHandler(currentValue, callback);
yMap.observeDeep(eventsHandler);
```

### `applyJsonDiffToYjs(oldValue, newValue, yValue, yValueParent, yValueKey)`

Applies the difference between two JSON objects to a Yjs type.

- **Parameters:**
  - `oldValue` (_any_): The original JSON value.
  - `newValue` (_any_): The new JSON value.
  - `yValue` (_Y.Map_ | _Y.Array_ | _Y.Text_): The Yjs type to apply the changes to.
  - `yValueParent` (_Y.Map_ | _Y.Array_ | _undefined_): The parent of the Yjs type.
  - `yValueKey` (_string_ | _number_ | _undefined_): The key or index in the parent where `yValue` is located.
- **Returns:**
  - `void`

**Usage:**

```javascript
applyJsonDiffToYjs(oldValue, newValue, yValue, yValueParent, yValueKey);
```

### `jsonToYType(object)`

Converts a JSON object to a Yjs type.

- **Parameters:**
  - `object` (_any_): The JSON object to convert.
- **Returns:**
  - _Y.Map_ | _Y.Array_ | _Y.Text_ | _primitive value_

**Usage:**

```javascript
const yType = jsonToYType(jsonObject);
```

## Examples

### Nested Structures Synchronization

Synchronize nested maps and arrays between a Yjs document and a plain object.

```javascript
ydoc.transact(() => {
  const nestedMap = new Y.Map();
  nestedMap.set('key1', 'value1');
  yMap.set('nested', nestedMap);
});

console.log(currentValue);
// Output:
// {
//   nested: {
//     key1: 'value1',
//   },
// }

// Update nested map
ydoc.transact(() => {
  const nestedMap = yMap.get('nested');
  nestedMap.set('key2', 'value2');
});

console.log(currentValue);
// Output:
// {
//   nested: {
//     key1: 'value1',
//     key2: 'value2',
//   },
// }
```

### Conflict Resolution with Concurrent Changes

Simulate concurrent changes and observe conflict resolution.

```javascript
// Create two separate Yjs documents
const ydoc1 = new Y.Doc();
const ydoc2 = new Y.Doc();

const yMap1 = ydoc1.getMap('rootMap');
const yMap2 = ydoc2.getMap('rootMap');

// Initialize both documents
ydoc1.transact(() => {
  yMap1.set('sharedNumber', 1);
});
ydoc2.transact(() => {
  yMap2.set('sharedNumber', 1);
});

// Apply concurrent changes
ydoc1.transact(() => {
  yMap1.set('sharedNumber', 2);
});
ydoc2.transact(() => {
  yMap2.set('sharedNumber', 3);
});

// Exchange updates
const update1 = Y.encodeStateAsUpdate(ydoc1);
const update2 = Y.encodeStateAsUpdate(ydoc2);

Y.applyUpdate(ydoc1, update2);
Y.applyUpdate(ydoc2, update1);

// Verify the merged result
console.log(yMap1.get('sharedNumber')); // Output: 3
console.log(yMap2.get('sharedNumber')); // Output: 3
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **[Yjs](https://github.com/yjs/yjs)**: A powerful CRDT implementation for building collaborative applications.
