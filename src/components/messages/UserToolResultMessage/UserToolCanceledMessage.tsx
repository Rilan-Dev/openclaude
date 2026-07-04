import { c as _c } from "react-compiler-runtime";
import { InterruptedByUser } from 'src/components/InterruptedByUser.js';
import { MessageResponse } from 'src/components/MessageResponse.js';
import { isBrowserRuntime } from '../../../utils/runtime.js';
import { BrowserToolResultDisclosure } from './BrowserToolResultDisclosure.js';
export function UserToolCanceledMessage() {
  const $ = _c(1);
  if (isBrowserRuntime()) {
    return <BrowserToolResultDisclosure title="Tool use canceled" detail="Interrupted" state="error"><div className="oc-toolReadReceipt">The tool call was interrupted before it completed.</div></BrowserToolResultDisclosure>;
  }
  let t0;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t0 = <MessageResponse height={1}><InterruptedByUser /></MessageResponse>;
    $[0] = t0;
  } else {
    t0 = $[0];
  }
  return t0;
}
