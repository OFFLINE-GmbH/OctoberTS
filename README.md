# OctoberTS

TypeScript implementation of the October CMS Frontend Framework

## THIS IS A WORK IN PROGRESS

Do not use this in production. 

```bash
# install deps
yarn
# run tests
yarn test
```

## API

```ts
// Optional, adds IE11 support
import './framework/polyfills'

// Import requried features.
import {Build, withAttachLoading, withRequest, withValidation} from './framework'

// Attach Framework features to the DOM globally.
const framework = Build(
    withRequest(),
    withValidation(),
    withAttachLoading(),
)

// Use on demand.
const framework = Build()
const response = framework.request('onUpdate')
```

## Implementation status

* [ ] global DOM events api
* [ ] on demand api

### Framework extras

* [x] data-request-validate
* [x] data-attach-loading
* [ ] Loading indicator
* [ ] Flash messages
* [ ] data-request-flash
  * [ ] Error handling
  * [ ] Flash handling

### Framework 

* [x] data-request
* [x] data-track-input


## Incompatibilities

* `eval` attributes are not supported (`data-eval-*`)
* All event listeners need to get their data off of the `e.details` event property, instead of the multiple function attributes