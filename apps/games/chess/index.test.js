// @ts-check
/** @typedef {import('@tabulous/server/src/services/catalog').GameDescriptor} GameDescriptor */

import { buildDescriptorTestSuite } from '@tabulous/server/tests/games-test.js'

import * as descriptor from '.'

buildDescriptorTestSuite('chess', /** @type {GameDescriptor} */ (descriptor))
