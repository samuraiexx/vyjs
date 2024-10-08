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
  - [Applying Deltas to Yjs Documents](#applying-deltas-to-yjs-documents)
- [Running Tests](#running-tests)
- [API Reference](#api-reference)
  - [`getYjsEventsHandler(plainObject)`](#getyjseventshandlerplainobject)
  - [`applyJsonDiffPatchDelta(yType, delta)`](#applyjsondiffpatchdeltaytype-delta)
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
- **Delta Application**: Apply `jsondiffpatch` deltas to Yjs documents.
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
const plainObject = {};

// Create a Yjs document, a root map, and a plain object. Then, set up the synchronization:
const eventsHandler = getYjsEventsHandler(plainObject);
yMap.observeDeep(eventsHandler);

// Now, any changes made to yMap will be reflected in plainObject:

ydoc.transact(() => {
  yMap.set('number', 42);
  yMap.set('text', new Y.Text('Hello, Yjs!'));
});

console.log(plainObject);
// Output:
// {
//   number: 42,
//   text: 'Hello, Yjs!',
// }
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
    const plainObject = {};
    const eventsHandler = getYjsEventsHandler(plainObject);

    yMap.observeDeep(eventsHandler);

    // Update React state when plainObject changes
    const updateState = () => {
      setState({ ...plainObject });
    };

    // Observe changes in the Yjs document
    ydoc.on('update', updateState);

    return () => {
      ydoc.off('update', updateState);
    };
  }, []);

  // Now, state will be in sync with the Yjs document
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

### Applying Deltas to Yjs Documents

Import the `applyJsonDiffPatchDelta` function:

```javascript
import { applyJsonDiffPatchDelta } from 'vyjs';
import { Doc } from 'yjs'

const doc = new Doc();
const yMap = doc.getMap('map');

yMap.set('number', 42);
yMap.set('text', 'Hello, Yjs!');
yMap.delete('status');

// Create a delta using jsondiffpatch format:
const delta = {
  number: [42, 100],          // Update 'number' from 42 to 100
  status: [true],             // Add 'status' with value true
  text: ['Hello, Yjs!', 'Hi'], // Update 'text' from 'Hello, Yjs!' to 'Hi'
};

// Apply the delta to the Yjs document:
applyJsonDiffPatchDelta(yMap, delta);

console.log(yMap.get('number')); // Output: 100
console.log(yMap.get('status')); // Output: true
console.log(yMap.get('text').toString()); // Output: 'Hi'
```

## Running Tests
```bash
npm test
```
## API Reference

### `getYjsEventsHandler(plainObject)`

Returns an event handler function that synchronizes changes from a Yjs document to a plain JavaScript object.

- **Parameters:**
  - `plainObject` (_Object_): The plain JavaScript object to synchronize.
- **Returns:**
  - _(Function)_: An event handler to be used with `yMap.observeDeep()`.

**Usage:**

```javascript
const eventsHandler = getYjsEventsHandler(plainObject);
yMap.observeDeep(eventsHandler);
```

### `applyJsonDiffPatchDelta(yType, delta)`
Applies a jsondiffpatch delta to a Yjs document.

- **Parameters:**
  - `yType` (Y.Map | Y.Array | Y.Text): The Yjs type to apply the delta to.
  - `delta` (Delta): The delta object in jsondiffpatch format.
- **Returns:**
  - `void`

**Usage:**
```javascript
applyJsonDiffPatchDelta(yMap, delta);
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

console.log(plainObject);
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

console.log(plainObject);
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

// Verify that the last change wins
console.log(yMap1.get('sharedNumber')); // Output: 3
console.log(yMap2.get('sharedNumber')); // Output: 3
```

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments
- **[Yjs](https://github.com/yjs/yjs)**: A powerful CRDT implementation for building collaborative applications.
- **[jsondiffpatch](https://github.com/benjamine/jsondiffpatch)**: A library to diff and patch JavaScript objects.
