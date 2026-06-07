'use strict';

const EventType = {

  USER_CONNECT:     'user:connect',       
  USER_CONNECTED:   'user:connected',     
  USER_REJECTED:    'user:rejected',      
  USER_LIST:        'user:list',          
  USER_JOINED:      'user:joined',        
  USER_LEFT:        'user:left',          

  FILE_CREATE:      'file:create',        
  FILE_CREATED:     'file:created',       
  FILE_LIST:        'file:list',          
  FILE_LIST_RESULT: 'file:list:result',   
  FILE_OPEN:        'file:open',          
  FILE_OPENED:      'file:opened',        
  FILE_CLOSE:       'file:close',         
  FILE_CLOSED:      'file:closed',        
  FILE_SHARE:       'file:share',         
  FILE_SHARED:      'file:shared',        
  FILE_NOTIFY:      'file:notify',        
  FILE_DELETE:      'file:delete',        
  FILE_DELETED:     'file:deleted',       

  DRAW_ACTION:      'draw:action',        
  DRAW_BROADCAST:   'draw:broadcast',     
  CANVAS_SYNC:      'canvas:sync',        
  CANVAS_CLEAR:     'canvas:clear',       
  CANVAS_CLEARED:   'canvas:cleared',     

  CLIPBOARD_CUT:            'clipboard:cut',              
  CLIPBOARD_PASTE:          'clipboard:paste',            
  CLIPBOARD_CUT_BROADCAST:  'clipboard:cut:broadcast',    
  CLIPBOARD_PASTE_BROADCAST:'clipboard:paste:broadcast',  

  LAYER_ADD:        'layer:add',          
  LAYER_ADDED:      'layer:added',        
  LAYER_REMOVE:     'layer:remove',       
  LAYER_REMOVED:    'layer:removed',      
  LAYER_RENAME:     'layer:rename',       
  LAYER_REORDER:    'layer:reorder',      
  LAYER_VISIBILITY: 'layer:visibility',   
  LAYER_OPACITY:    'layer:opacity',      
  LAYER_UPDATE:     'layer:update',       

  ERROR_SERVER:     'error:server',       
};

function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

module.exports = { EventType, generateId };
