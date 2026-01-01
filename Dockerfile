# Use distroless as base image for a smaller, more secure image
FROM gcr.io/distroless/base-debian12:nonroot

# Arguments automatically provided by docker buildx
ARG TARGETOS
ARG TARGETARCH

# Copy the binary specific to the target architecture
# The build context must be prepared with the structure: linux/amd64/uppsyncd, linux/arm64/uppsyncd
# Use --chmod to ensure execution permissions since distroless has no shell to run chmod
COPY --chmod=0755 ${TARGETOS}/${TARGETARCH}/uppsyncd /usr/local/bin/uppsyncd

ENTRYPOINT ["/usr/local/bin/uppsyncd"]
