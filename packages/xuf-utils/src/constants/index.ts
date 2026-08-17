export enum XufSdkCommand {
  Ready = 'xuf-sdk:ready',
  Log = 'xuf-sdk:log',
  Link = 'xuf-sdk:link',
  Unlink = 'xuf-sdk:unlink',
  ConnectSignal = 'xuf-sdk:connect_signal',
  DisconnectSignal = 'xuf-sdk:disconnect_signal',
  Invoke = 'xuf-sdk:invoke',
  AddEventListener = 'xuf-sdk:add_event_listener',
  RemoveEventListener = 'xuf-sdk:remove_event_listener',
  PostEvent = 'xuf-sdk:post_event',
  InvokeExt = 'xuf-sdk:ctx_invoke_ext',
  OnExtEvent = 'xuf-sdk:on__ext_event',
  OffExtEvent = 'xuf-sdk:off_ext_event',
  EmitExtEvent = 'xuf-sdk:emit_ext_event',
}

export enum XufFrameworkCommand {
  Ready = 'xuf-framework:ready',
  LinkStatus = 'xuf-framework:link_status',
  InvokeResult = 'xuf-framework:invole_result',
  Signal = 'xuf-framework:signal',
  Event = 'xuf-framework:event',
  ExtEvent = 'xuf-framework:ext_event',
}
