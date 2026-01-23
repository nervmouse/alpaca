# Fix Errors Todo

## Data Loading Errors
- [x] Fix `DATA_LOADING_ERROR` in tests trying to load `../examples/...`.
  - These tests fail because they try to load local files via XHR which isn't supported or the path is wrong.
  - Solution: Mock `$.ajax` in `vitest.setup.js` to read files from `site/demos/` when `../examples/` is requested.

## Assertion Errors
- [ ] Fix `tests/js/hideInitValidationError.js`.
  - Error: `Initial validation should have discovered the form is invalid.: expected true to deeply equal false`.
  - Status: Debugged. Race condition identified. Async fix applied but test logic/validation state still causing failure.
- [ ] Fix assertions in `EditForm.js`, `CreateForm.js` etc.
  - Status: `View normalization` fixed. Now failing on element counts/visibility. This might be due to HappyDOM limitations or CSS.

## Runtime Errors
- [x] Fix `ReferenceError: observable is not defined` in `tests/js/fields/AddressField.js`.
  - Location: `src/js/ObservableUtils.js:184:24`.
- [x] Fix `View normalization failed` in `tests/js/forms/EditForm.js`.
  - Solution: Added legacy view aliases in `vitest.setup.js`.
- [x] Fix `TypeError` in `CreateForm.js` due to missing fixture.
  - Solution: Added setup/teardown with fixture creation.

## Other Errors
- [ ] Investigate and fix timeouts in `tests/js/fields/ArrayField.js`.
