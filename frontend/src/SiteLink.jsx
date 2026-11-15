// Keep normal browser behavior for modifier clicks and open-in-new-tab.
export default function SiteLink({href,go,children,...props}){
  return <a href={href} {...props} onClick={e=>{
    if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return
    e.preventDefault()
    go(href)
  }}>{children}</a>
}
