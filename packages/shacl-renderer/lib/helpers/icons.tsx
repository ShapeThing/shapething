// A central place to get icons from for the app.
const caretIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M8.72 18.78a.75.75 0 0 1 0-1.06L14.44 12L8.72 6.28a.751.751 0 0 1 .018-1.042a.751.751 0 0 1 1.042-.018l6.25 6.25a.75.75 0 0 1 0 1.06l-6.25 6.25a.75.75 0 0 1-1.06 0Z"/>'
}
const languageIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M12 1c6.075 0 11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12S5.925 1 12 1Zm3.241 10.5v-.001c-.1-2.708-.992-4.904-1.89-6.452a13.919 13.919 0 0 0-1.304-1.88L12 3.11l-.047.059c-.354.425-.828 1.06-1.304 1.88c-.898 1.547-1.79 3.743-1.89 6.451Zm-12.728 0h4.745c.1-3.037 1.1-5.49 2.093-7.204c.39-.672.78-1.233 1.119-1.673C6.11 3.329 2.746 7 2.513 11.5Zm18.974 0C21.254 7 17.89 3.329 13.53 2.623c.339.44.729 1.001 1.119 1.673c.993 1.714 1.993 4.167 2.093 7.204ZM8.787 13c.182 2.478 1.02 4.5 1.862 5.953c.382.661.818 1.29 1.304 1.88l.047.057l.047-.059c.354-.425.828-1.06 1.304-1.88c.842-1.451 1.679-3.471 1.862-5.951Zm-1.504 0H2.552a9.505 9.505 0 0 0 7.918 8.377a15.773 15.773 0 0 1-1.119-1.673C8.413 18.085 7.47 15.807 7.283 13Zm9.434 0c-.186 2.807-1.13 5.085-2.068 6.704c-.39.672-.78 1.233-1.118 1.673A9.506 9.506 0 0 0 21.447 13Z"/>'
}
const handleIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M9 13a1 1 0 1 1 0-2a1 1 0 0 1 0 2Zm7-1a1 1 0 1 1-2 0a1 1 0 0 1 2 0ZM9 8a1 1 0 1 1 0-2a1 1 0 0 1 0 2Zm7-1a1 1 0 1 1-2 0a1 1 0 0 1 2 0ZM9 18a1 1 0 1 1 0-2a1 1 0 0 1 0 2Zm6 0a1 1 0 1 1 0-2a1 1 0 0 1 0 2Z"/>'
}
const linkIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M14.78 3.653a3.936 3.936 0 1 1 5.567 5.567l-3.627 3.627a3.936 3.936 0 0 1-5.88-.353a.75.75 0 0 0-1.18.928a5.436 5.436 0 0 0 8.12.486l3.628-3.628a5.436 5.436 0 1 0-7.688-7.688l-3 3a.75.75 0 0 0 1.06 1.061l3-3Z"/><path fill="currentColor" d="M7.28 11.153a3.936 3.936 0 0 1 5.88.353a.75.75 0 0 0 1.18-.928a5.436 5.436 0 0 0-8.12-.486L2.592 13.72a5.436 5.436 0 1 0 7.688 7.688l3-3a.75.75 0 1 0-1.06-1.06l-3 3a3.936 3.936 0 0 1-5.567-5.568l3.627-3.627Z"/>'
}
const editIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M17.263 2.177a1.75 1.75 0 0 1 2.474 0l2.586 2.586a1.75 1.75 0 0 1 0 2.474L19.53 10.03l-.012.013L8.69 20.378a1.753 1.753 0 0 1-.699.409l-5.523 1.68a.748.748 0 0 1-.747-.188a.748.748 0 0 1-.188-.747l1.673-5.5a1.75 1.75 0 0 1 .466-.756L14.476 4.963ZM4.708 16.361a.26.26 0 0 0-.067.108l-1.264 4.154l4.177-1.271a.253.253 0 0 0 .1-.059l10.273-9.806l-2.94-2.939l-10.279 9.813ZM19 8.44l2.263-2.262a.25.25 0 0 0 0-.354l-2.586-2.586a.25.25 0 0 0-.354 0L16.061 5.5Z"/>'
}

const plusIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M11.75 4.5a.75.75 0 0 1 .75.75V11h5.75a.75.75 0 0 1 0 1.5H12.5v5.75a.75.75 0 0 1-1.5 0V12.5H5.25a.75.75 0 0 1 0-1.5H11V5.25a.75.75 0 0 1 .75-.75Z"/>'
}

const addIcon = plusIcon

const dismissIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M5.72 5.72a.75.75 0 0 1 1.06 0L12 10.94l5.22-5.22a.749.749 0 0 1 1.275.326a.749.749 0 0 1-.215.734L13.06 12l5.22 5.22a.749.749 0 0 1-.326 1.275a.749.749 0 0 1-.734-.215L12 13.06l-5.22 5.22a.751.751 0 0 1-1.042-.018a.751.751 0 0 1-.018-1.042L10.94 12L5.72 6.78a.75.75 0 0 1 0-1.06Z"/>'
}

const trashIcon = dismissIcon

const editDocumentIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M10.5 5.75a.75.75 0 0 1 .75.75v3.25h3.25a.75.75 0 0 1 0 1.5h-3.25v3.25a.75.75 0 0 1-1.5 0v-3.25H6.5a.75.75 0 0 1 0-1.5h3.25V6.5a.75.75 0 0 1 .75-.75Z"/><path fill="currentColor" d="M0 10.5C0 4.701 4.701 0 10.5 0S21 4.701 21 10.5c0 2.63-.967 5.033-2.564 6.875l4.344 4.345a.749.749 0 1 1-1.06 1.06l-4.345-4.344A10.459 10.459 0 0 1 10.5 21C4.701 21 0 16.299 0 10.5Zm10.5-9a9 9 0 0 0-9 9a9 9 0 0 0 9 9a9 9 0 0 0 9-9a9 9 0 0 0-9-9Z"/>'
}

const checkboxIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M17.28 9.28a.75.75 0 0 0-1.06-1.06l-5.97 5.97l-2.47-2.47a.75.75 0 0 0-1.06 1.06l3 3a.75.75 0 0 0 1.06 0l6.5-6.5Z"/><path fill="currentColor" d="M3.75 2h16.5c.966 0 1.75.784 1.75 1.75v16.5A1.75 1.75 0 0 1 20.25 22H3.75A1.75 1.75 0 0 1 2 20.25V3.75C2 2.784 2.784 2 3.75 2ZM3.5 3.75v16.5c0 .138.112.25.25.25h16.5a.25.25 0 0 0 .25-.25V3.75a.25.25 0 0 0-.25-.25H3.75a.25.25 0 0 0-.25.25Z"/>'
}
const squareIcon = {
  width: 24,
  height: 24,
  body: '<path fill="currentColor" d="M6 7.75C6 6.784 6.784 6 7.75 6h8.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 16.25 18h-8.5A1.75 1.75 0 0 1 6 16.25Zm1.75-.25a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25Z"/>'
}

const checkboxChecked = {
  width: 24,
  height: 24,
  body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><rect width="16.5" height="16.5" x="3.75" y="3.75" rx="4" /><path d="m16.512 9.107l-5.787 5.786l-3.237-3.232" /></g>'
}

const checkboxUnchecked = {
  width: 24,
  height: 24,
  body: '<rect width="16.5" height="16.5" x="3.75" y="3.75" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" rx="4" />'
}

const checkboxIndeterminate = {
  width: 24,
  height: 24,
  body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><rect width="16.5" height="16.5" x="3.75" y="3.75" rx="4" /><path d="M16.19 12H7.81" /></g>'
}

export {
  addIcon,
  caretIcon,
  checkboxChecked,
  checkboxIcon,
  checkboxIndeterminate,
  checkboxUnchecked,
  dismissIcon,
  editDocumentIcon,
  editIcon,
  handleIcon,
  languageIcon,
  linkIcon,
  plusIcon,
  squareIcon,
  trashIcon
}
