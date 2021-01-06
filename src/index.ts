import { attach, attachSync } from './modules/memory'

export {
  attach,
  attachSync
}

// search full process for bytes "00 00 00 00 7E E0 63 41"
// s -b 0 L?7fffffffffff 00 00 00 00 7E E0 63 41
