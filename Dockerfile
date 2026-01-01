FROM debian:stable-slim

# Install CA certificates for HTTPS requests
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

# Arguments automatically provided by docker buildx
ARG TARGETOS
ARG TARGETARCH

# Copy the binary specific to the target architecture
# The build context must be prepared with the structure: linux/amd64/uppsyncd, linux/arm64/uppsyncd
COPY ${TARGETOS}/${TARGETARCH}/uppsyncd /usr/local/bin/uppsyncd

RUN chmod +x /usr/local/bin/uppsyncd

ENTRYPOINT ["/usr/local/bin/uppsyncd"]
