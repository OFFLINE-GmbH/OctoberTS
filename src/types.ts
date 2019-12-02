declare global {
    interface Window {
        NodeList: NodeList
        CustomEvent: Function
    }
}
