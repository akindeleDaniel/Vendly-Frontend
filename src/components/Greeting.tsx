// "Hi Balake": greets a signed-in person by their first name. Nothing is drawn without a name.
function Greeting({ name }: { name: string }) {
    const firstName = name.trim().split(/\s+/)[0]

    if (!firstName) {
        return null
    }

    return <p className="greeting">Hi {firstName}</p>
}

export default Greeting
