import { readFileSync } from 'node:fs';

const replaceOnce = (source, before, after) => {
  if (source.split(before).length !== 2)
    throw new Error(
      `Unsupported native sales adapter anchor: ${before.slice(0, 90)}`,
    );
  return source.replace(before, after);
};
const code = (name) =>
  readFileSync(new URL(name, import.meta.url), 'utf8').replaceAll(
    'export const ',
    'const ',
  );
const policy = () => code('sales-bulk-policy.mjs');

export const patchSalesIndex = (source) => {
  let next = replaceOnce(
    source,
    'GCt=({objectNameSingular:e,contextStoreInstanceId:t})=>{',
    'GCt=({objectNameSingular:e,contextStoreInstanceId:t})=>{if(e==="opportunity")return(0,r.jsx)(crmSalesFilters.hasScope(t)?crmSalesFilters.Panel:crmSalesBulk.Panel,{contextStoreInstanceId:t});',
  );
  // Keep the native field form and controls; imported audit JSON/keys are not
  // editable operational fields and funnel/stage are handled together above it.
  next = replaceOnce(
    next,
    '.filter(MCt).sort((o,l)=>o.name.localeCompare(l.name))',
    '.filter(MCt).filter(o=>e!=="opportunity"||isOperationalSalesField(e,o.name)&&!["salesPipeline","salesStage"].includes(o.name)).sort((o,l)=>o.label.localeCompare(l.label))',
  );
  next = replaceOnce(
    next,
    'title:b._({id:"0KAL3W"}),label:b._({id:"fvImQM"',
    'title:"Ações em massa",label:b._({id:"fvImQM"',
  );
  next = replaceOnce(
    next,
    'DLe=({sidePanelPageInstanceId:e})=>{',
    'DLe=({sidePanelPageInstanceId:e})=>{if(crmSalesFilters.hasScope(e))return(0,r.jsx)(ac,{title:"Filtros de negociações",label:"Funil e etapa"});if(crmSalesBulk.hasScope(e))return(0,r.jsx)(ac,{title:"Ações em massa",label:"Seleção por fase"});',
  );
  next = replaceOnce(
    next,
    'recordFormPageLayout:t,fieldMetadataItems:e.fields',
    'recordFormPageLayout:t,fieldMetadataItems:e.fields.filter(field=>isOperationalSalesField(e.nameSingular,field.name))',
  );
  next = replaceOnce(
    next,
    'inlineFieldMetadataItems:[...o??[],...c].sort',
    'inlineFieldMetadataItems:[...o??[],...c].filter(field=>isOperationalSalesField(e,field.name)).sort',
  );
  next = replaceOnce(
    next,
    '})=>{if(GU(e))return',
    '})=>{if(!isOperationalSalesField(e.metadata.objectMetadataNameSingular,e.metadata.fieldName))return null;if(GU(e))return',
  );
  const setup = `\n${policy()}\n${code('sales-bulk-runtime.mjs')}\n${code('sales-filters-runtime.mjs')}\nconst crmSalesBulk=createSalesBulkUi({React:y,Button:Nt,Dropdown:Z,Form:LCt,Dialog:hd,useTheme:We,useCoreClient:La,useMetadata:Gt,useStateValue:le,useAtomValue:U,objectId:nf,rule:gE,filters:_5,groups:aU,search:lU,fields:w0,useDependencies:V5,computeFilter:iU,useCreate:r5,useUpdate:WCt,usePermissions:ar,useToast:en,useDialog:xl,isEditable:MCt,gql:yn,BulkIcon:Il,ChevronIcon:is,icons:{pipeline:crmArrowIcon,stage:crmArrowIcon,owner:crmOwnerIcon,duplicate:crmCopyIcon,delete:crmTrashIcon}});\nconst crmSalesFilters=createSalesFiltersUi({React:y,Button:Nt,Section:ss,Picker:crmSalesBulk.Picker,useCoreClient:La,useTheme:We,useNavigateApp:Su,RecordIndexPage:Ce.RecordIndexPage,useSidePanel:kn,useMetadata:Gt,useStateValue:le,filters:_5,objectId:nf,gql:yn,FilterIcon:crmFilterIcon});\nexport function crmNativeHost(){return {Button:Nt,useCoreClient:La,SelectionIcon:crmSelectIcon,gql:yn,useNavigate:o5,bulk:crmSalesBulk,openFilters:crmSalesFilters.open,isOperational:isOperationalSalesField};}\n`;
  return (
    'import {t as crmOwnerIcon} from \"./IconUserPin-BA4YUhyf.js\";\nimport {t as crmSelectIcon} from \"./IconSquareRoundedCheck-_QjQzihg.js\";\nimport {t as crmFilterIcon} from \"./IconFilter-BwWK91j4.js\";\nimport {t as crmArrowIcon} from \"./IconArrowRight-Z0OJN07v.js\";\nimport {t as crmCopyIcon} from \"./IconCopyPlus-DYtwDS9m.js\";\nimport {t as crmTrashIcon} from \"./IconTrash-h0izILIX.js\";\n' +
    next +
    setup +
    '\nexport function crmUseStagePickerFilter(name,filters){return stagePickerFilter(name,filters,U(w0));}\n'
  );
};

export const patchSalesBoard = (source) => {
  let next = replaceOnce(
    source,
    'for(const i of n){const l=t(xe,i);C(l)&&l.isVisible&&Rj(a,l,o)}',
    'for(const i of n){const l=t(xe,i),crmAllowed=t(crmStageScope,{instanceId:e});C(l)&&l.isVisible&&(crmAllowed===null||crmAllowed.includes(l.value))&&Rj(a,l,o)}',
  );
  next = replaceOnce(
    next,
    'm=z(or).filter(h=>h.isVisible);',
    'm=z(or).filter(h=>h.isVisible&&(R(crmStageScope)===null||R(crmStageScope).includes(h.value)));',
  );
  // Hook calls cannot be inside filter callbacks: subscribe once per render.
  next = next.replace(
    'm=z(or).filter(h=>h.isVisible&&(R(crmStageScope)===null||R(crmStageScope).includes(h.value)));',
    'crmAllowed=R(crmStageScope),m=z(or).filter(h=>h.isVisible&&(crmAllowed===null||crmAllowed.includes(h.value)));',
  );
  next = replaceOnce(
    next,
    'children:[(0,s.jsx)(SO,{}),(0,s.jsx)(vO,{})',
    'children:[(0,s.jsx)(crmSalesBoard.FilterEffect,{}),(0,s.jsx)(SO,{}),(0,s.jsx)(vO,{})',
  );
  next = replaceOnce(
    next,
    '})})]}),!l&&(0,s.jsxs)(gw,{',
    '})})]}),(0,s.jsx)(crmSalesBoard.Button,{stageId:i?.name==="salesStage"?e.value:null}),!l&&(0,s.jsxs)(gw,{',
  );
  next = replaceOnce(
    next,
    'return{filterableFieldMetadataItems:t}},Cu=',
    'return{filterableFieldMetadataItems:t.filter(field=>crmNativeHost().isOperational(e.nameSingular,field.name))}},Cu=',
  );
  return (
    'import {crmNativeHost} from "./index-CgifpLnX.js";\n' +
    next +
    `\n${policy()}\n${code('sales-board-runtime.mjs')}\nconst crmStageScope=V({key:"crmSalesStageScope",defaultValue:null,componentInstanceContext:Oe});\nconst crmSalesBoard=createSalesBoardUi({React:f,getHost:crmNativeHost,useIndex:q,useQuery:xa,useClient:Gt,useStore:M,useValue:R,useAtomValue:ge,filters:Ze,groups:sr,fields:Wt,useDependencies:In,computeFilter:on,scope:crmStageScope});\n`
  );
};

export const patchSalesCommands = (source) => {
  let next = replaceOnce(
    source,
    'page:pe.UpdateRecords,pageTitle:N._({id:"0KAL3W"})',
    'page:pe.UpdateRecords,pageTitle:"Ações em massa"',
  );
  // Engine command labels originate in server metadata; retain its identity and
  // conditions, changing only presentation for opportunities.
  next = replaceOnce(
    next,
    'label:Ln(e.label,r),shortLabel:n(e.shortLabel)',
    'label:e.engineComponentKey===F.UPDATE_MULTIPLE_RECORDS&&t.objectMetadataItem?.nameSingular==="opportunity"?"Ações em massa":Ln(e.label,r),shortLabel:n(e.shortLabel)',
  );
  next = replaceOnce(
    next,
    'Mp=({item:e,Icon:t,label:r})=>{const n=ft',
    'Mp=({item:e,Icon:t,label:r})=>{const crmNavigate=ir().navigateSidePanel,crmStore=Y();const n=ft',
  );
  next = replaceOnce(
    next,
    'handleClick:async()=>{if(w){if(d)return;',
    'handleClick:async()=>{if(e.universalIdentifier==="c4dbfcd8-ceae-4628-82d8-9a19aafad01d"||e.frontComponent?.universalIdentifier==="690c2cf9-bbf7-48d1-8616-8c4f63f3ef9b"){I();crmNativeHost().openFilters(crmNavigate,crmStore,c,o.objectMetadataItem.id);return;}if(w){if(d)return;',
  );
  next = replaceOnce(
    next,
    'if(!o)return!1;const i=o.id===n.labelIdentifierFieldMetadataId',
    'if(!o||!crmNativeHost().isOperational(n.nameSingular,o.name))return!1;const i=o.id===n.labelIdentifierFieldMetadataId',
  );
  return 'import {crmNativeHost} from "./index-CgifpLnX.js";\n' + next;
};

export const patchSalesPicker = (source) => {
  const next = replaceOnce(
    source,
    'objectNameSingular:t,limit:10,allowRequestsToTwentyIcons:a}',
    'objectNameSingular:t,limit:10,allowRequestsToTwentyIcons:a,filter:crmUseStagePickerFilter(t,c)}',
  );
  return (
    'import {crmUseStagePickerFilter} from "./index-CgifpLnX.js";\n' + next
  );
};

export const patchSalesToolbar = (source) => {
  let next = replaceOnce(
    source,
    'className:r,leftComponent:(0,e.jsx)(Yn,{}),rightComponent:',
    'className:[r,a==="opportunities"?"crm-sales-topbar":""].filter(Boolean).join(" "),leftComponent:a==="opportunities"?(0,e.jsx)(crmSalesToolbar,{viewPicker:(0,e.jsx)(Yn,{salesToolbar:true})}):(0,e.jsx)(Yn,{}),rightComponent:',
  );
  next = replaceOnce(
    next,
    'Yn=()=>{const t=Lr()',
    'Yn=({salesToolbar:crmSales=false}={})=>{const t=Lr()',
  );
  next = replaceOnce(
    next,
    'clickableComponent:(0,e.jsxs)(Nu,{isUnfolded:d,children:',
    'clickableComponent:(0,e.jsxs)(Nu,{isUnfolded:d,className:crmSales?"crm-sales-view-trigger":void 0,title:crmSales?r?.name:void 0,children:',
  );
  next = replaceOnce(
    next,
    'children:(0,e.jsx)(Qt,{text:r?.name??D._({id:"N40H+G"})})',
    'children:crmSales?(r?.name??"Selecionar funil"):(0,e.jsx)(Qt,{text:r?.name??D._({id:"N40H+G"})})',
  );
  next = replaceOnce(
    next,
    'text:o.name,LeftComponent:',
    'text:crmPickerObject.nameSingular==="opportunity"?(0,e.jsx)("span",{className:"crm-sales-menu-name",title:o.name,children:o.name}):o.name,LeftComponent:',
  );
  // Reuse Twenty's drag handlers and saved view positions, including their
  // standard workspace/unlisted groups. Only expose reordering to view editors.
  next = replaceOnce(
    next,
    'const{i18n:t,_:r}=z(),{objectMetadataItem:n}=Le(),o=ie(Et,{objectMetadataItemId:n.id}),{currentView:a}=X()',
    'const{i18n:t,_:r}=z(),{objectMetadataItem:n}=Le(),crmIsSales=n.nameSingular==="opportunity",crmCanReorder=Yr(Kr.VIEWS),crmMoving=(0,S.useRef)(false),o=ie(Et,{objectMetadataItemId:n.id}),{currentView:a}=X()',
  );
  next = replaceOnce(
    next,
    'return(0,e.jsxs)(H,{children:[i.length>0',
    'return(0,e.jsxs)(H,{widthInPixels:crmIsSales?380:void 0,children:[crmIsSales&&crmCanReorder&&(0,e.jsx)("div",{className:"crm-sales-view-hint",children:"Use Mais opções para mover um funil"}),i.length>0',
  );
  next = replaceOnce(
    next,
    'isDragDisabled:i.length===1,itemComponent:',
    'isDragDisabled:i.length===1||crmIsSales&&!crmCanReorder,itemComponent:',
  );
  next = replaceOnce(
    next,
    'isDragDisabled:d.length===1,itemComponent:',
    'isDragDisabled:d.length===1||crmIsSales&&!crmCanReorder,itemComponent:',
  );
  // Use the object context rather than comparing a deployment-specific UUID.
  next = replaceOnce(
    next,
    'handleViewSelect:a,isCurrentView:s})=>{const i=',
    'handleViewSelect:a,isCurrentView:s,onMoveUp:crmMoveUp,onMoveDown:crmMoveDown})=>{const {objectMetadataItem:crmPickerObject}=Le();const i=',
  );
  next = replaceOnce(
    next,
    'dropdownContent:(0,e.jsxs)(q.Section,{children:[(0,e.jsx)(q.ActionItem,{startIcon:R?',
    'dropdownContent:(0,e.jsxs)(q.Section,{children:[crmMoveUp&&(0,e.jsx)(q.ActionItem,{onClick:crmMoveUp,children:"Mover para cima"}),crmMoveDown&&(0,e.jsx)(q.ActionItem,{onClick:crmMoveDown,children:"Mover para baixo"}),(0,e.jsx)(q.ActionItem,{startIcon:R?',
  );
  for (const [list, prefix] of [
    ['i', 'R'],
    ['d', 'N'],
  ]) {
    const anchor = `${prefix}=(0,S.useCallback)(async b=>{if(!b.destination)return;const V=Gn(${list},`;
    const replacement = `${prefix}=(0,S.useCallback)(async b=>{if(crmIsSales){if(crmCanReorder)await persistSalesViewOrder(${list},b,crmMoving,w,Gn);return;}if(!b.destination)return;const V=Gn(${list},`;
    next = replaceOnce(next, anchor, replacement);
    next = replaceOnce(
      next,
      `},[w,${list}])`,
      `},[w,${list},crmIsSales,crmCanReorder])`,
    );
  }
  for (const [list, handler] of [
    ['i', 'R'],
    ['d', 'N'],
  ]) {
    const anchor = `isDragDisabled:${list}.length===1||crmIsSales&&!crmCanReorder,itemComponent:(0,e.jsx)(Kn,{view:b,`;
    const canMove =
      'crmIsSales&&crmCanReorder&&b.type==="KANBAN"&&b.icon==="IconLock"';
    const move = (direction) =>
      `()=>${handler}({source:{index:V},destination:{index:V${direction}1}})`;
    next = replaceOnce(
      next,
      anchor,
      anchor +
        `onMoveUp:${canMove}&&V>0?${move('-')}:void 0,onMoveDown:${canMove}&&V<${list}.length-1?${move('+')}:void 0,`,
    );
  }
  return (
    'import {crmNativeHost} from "./index-CgifpLnX.js";\n' +
    'import {t as crmCurrentMember} from "./currentWorkspaceMemberState-BHtlcIL4.js";\n' +
    'import {t as crmOwnerIcon} from "./IconUserPin-BA4YUhyf.js";\n' +
    'import {t as crmStatusIcon} from "./IconSquareRoundedCheck-_QjQzihg.js";\n' +
    next +
    '\n' +
    policy() +
    '\n' +
    code('sales-toolbar-policy.mjs').replace(
      "import { salesStatusCriteria } from './sales-bulk-policy.mjs';",
      '',
    ) +
    '\n' +
    code('sales-toolbar-runtime.mjs') +
    '\n' +
    'const crmSalesToolbar=createSalesToolbar({React:S,Button:_e,Dropdown:q,useIndex:W,useView:X,useValue:h,useSet:T,filters:Ce,groups:ve,sorts:tt,toNativeFilters:va,useMember:()=>fe(crmCurrentMember),getNative:crmNativeHost,Chevron:wo,OwnerIcon:crmOwnerIcon,StatusIcon:crmStatusIcon,SortIcon:$i});\n'
  );
};

export const patchSalesContactPicker = (source) => {
  let next = replaceOnce(
    source,
    'd=e.length>0,x=d?{id:{in:e}}:void 0,{loading:S,searchRecords:v,error:h}',
    'crmPhone=useContactPhoneLookup(i.length===1&&i[0]==="person"?s:""),d=e.length>0,x=d?{id:{in:e}}:void 0,{loading:S,searchRecords:v,error:h}',
  );
  next = replaceOnce(
    next,
    'filter:x,skip:!d,searchInput:s}',
    'filter:crmPhone.enabled?{id:{in:e.filter(id=>crmPhone.ids.includes(id))}}:x,skip:!d||crmPhone.enabled&&(crmPhone.loading||!e.some(id=>crmPhone.ids.includes(id))),searchInput:crmPhone.enabled?"":s}',
  );
  next = replaceOnce(
    next,
    'filter:C.length?{not:{id:{in:C}}}:void 0,limit:r??60,searchInput:s,fetchPolicy:"cache-and-network"',
    'filter:crmPhone.enabled?{id:{in:crmPhone.ids.filter(id=>!C.includes(id))}}:C.length?{not:{id:{in:C}}}:void 0,skip:crmPhone.enabled&&(crmPhone.loading||!crmPhone.ids.some(id=>!C.includes(id))),limit:r??60,searchInput:crmPhone.enabled?"":s,fetchPolicy:"cache-and-network"',
  );
  next = replaceOnce(
    next,
    'recordsToSelectError:F,pickableMorphItems:',
    'recordsToSelectError:crmPhone.error??F,pickableMorphItems:',
  );
  next = replaceOnce(
    next,
    'loading:P||u||S}},B=R',
    'loading:crmPhone.loading||P||u||S}},B=R',
  );
  return (
    'import {t as crmPhoneClient} from "./useApolloCoreClient-C-mOx_nk.js";\n' +
    'import {t as crmPhoneQuery} from "./useQuery-CtcJMKbb.js";\n' +
    'import {t as crmPhoneGql} from "./lib-C3IpGLsk.js";\n' +
    next +
    '\n' +
    code('contact-phone-search.mjs') +
    `
const crmContactPhoneQuery = crmPhoneGql('query CrmFindContactsByPhone($filter:PersonFilterInput!){people(first:100,filter:$filter){edges{node{id}}}}');
const useContactPhoneLookup = (search) => {
  const filter = contactPhoneFilter(search);
  const client = crmPhoneClient();
  const { data, error, loading } = crmPhoneQuery(crmContactPhoneQuery, {
    client, skip: !filter, variables: { filter },
  });
  return { enabled: Boolean(filter), loading: Boolean(filter) && loading,
    error: filter ? error : undefined, ids: data?.people?.edges.map(({ node }) => node.id) ?? [] };
};
`
  );
};
