import React from 'react';
import { Document, Page, Text, renderToBuffer } from '@react-pdf/renderer';
const doc = React.createElement(Document, { title: 'test', language: 'en' },
  React.createElement(Page, { size: 'LETTER' },
    React.createElement(Text, null, 'Hello')
  )
);
console.log('Starting render...');
const t = Date.now();
const buf = await renderToBuffer(doc);
console.log('Done:', buf.length, 'bytes,', Date.now()-t, 'ms');
console.log('Starts with %PDF:', buf.slice(0,4).toString() === '%PDF');
process.exit(0);
